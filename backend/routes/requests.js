const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase');
const { fetchCodes, attachOwners } = require('../lib/owner');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

async function uploadPhoto(file) {
  if (!file) return null;
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `co-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const { error } = await supabase.storage.from('TrackFolder').upload(filename, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error('Upload foto gagal: ' + error.message);
  const { data } = supabase.storage.from('TrackFolder').getPublicUrl(filename);
  return data.publicUrl;
}

// ── GET all requests (admin) ─────────────────────────────
// ?status=pending|approved|rejected|all
router.get('/', async (req, res) => {
  const { status = 'pending' } = req.query;

  let query = supabase
    .from('parcel_requests')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Pemilik hanya dari owner_code_id — nama penerima diketik bebas oleh
  // user jadi tidak boleh dipakai menebak kepemilikan.
  const codes = await fetchCodes();
  res.json(attachOwners(await markDuplicates(data || []), codes, { allowNameMatch: false }));
});

// Tandai resi yang sudah pernah masuk — baik sudah jadi parcel maupun
// disetor dua kali di daftar request yang sama.
const normTn = s => (s || '').trim().toLowerCase();

async function markDuplicates(requests) {
  if (!requests.length) return requests;

  const numbers = [...new Set(requests.map(r => (r.tracking_number || '').trim()).filter(Boolean))];

  const [hc, wh] = await Promise.all([
    supabase.from('hc_parcels').select('tracking_number, batch_id').in('tracking_number', numbers),
    supabase.from('wh_parcels').select('tracking_number, batch_id').in('tracking_number', numbers),
  ]);

  const existing = new Set([...(hc.data || []), ...(wh.data || [])].map(p => normTn(p.tracking_number)));

  // Hitung berapa kali nomor yang sama muncul di daftar request ini
  const seen = new Map();
  for (const r of requests) {
    const key = normTn(r.tracking_number);
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  return requests.map(r => {
    const key = normTn(r.tracking_number);
    const inParcels = existing.has(key);
    const repeated = (seen.get(key) || 0) > 1;
    return {
      ...r,
      duplicate_of: inParcels ? 'parcel' : repeated ? 'request' : null,
      duplicate_count: seen.get(key) || 1,
    };
  });
}

// ── GET pending count (for badge) ───────────────────────
router.get('/count', async (req, res) => {
  const { count, error } = await supabase
    .from('parcel_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count });
});

// ── POST submit requests (user) — max 10, with CO photos ────────────────
router.post('/', upload.any(), async (req, res) => {
  const { type, items: itemsJson } = req.body;

  // Siapa yang menyetor — diambil dari kode akses di header, bukan dari body,
  // supaya pengirim tidak bisa mengaku-aku sebagai pelanggan lain.
  const rawCode = (req.get('X-Access-Code') || '').trim();
  let ownerCodeId = null;
  if (rawCode) {
    const { data: codeRow } = await supabase
      .from('access_codes').select('id').ilike('code', rawCode).single();
    ownerCodeId = codeRow?.id ?? null;
  }

  let items;
  try { items = JSON.parse(itemsJson); } catch { return res.status(400).json({ error: 'Data tidak valid' }); }

  if (!type || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }
  if (items.length > 10) {
    return res.status(400).json({ error: 'Maksimal 10 resi per setor' });
  }

  // Map co_photo files by index
  const coPhotoFiles = {};
  (req.files || []).forEach(f => {
    const match = f.fieldname.match(/^co_photo_(\d+)$/);
    if (match) coPhotoFiles[parseInt(match[1])] = f;
  });

  // Validate
  for (const [i, item] of items.entries()) {
    if (!item.tracking_number?.trim() || !item.recipient_name?.trim()) {
      return res.status(400).json({ error: `Baris ${i + 1}: nomor resi dan nama penerima wajib diisi` });
    }
  }

  try {
    // Upload CO photos & build rows
    const rows = await Promise.all(items.map(async (item, i) => ({
      type,
      tracking_number: item.tracking_number.trim(),
      recipient_name: item.recipient_name.trim(),
      parcel_type: item.parcel_type || 'barang',
      notes: item.notes?.trim() || null,
      co_photo_url: await uploadPhoto(coPhotoFiles[i] || null),
      owner_code_id: ownerCodeId,
      status: 'pending',
    })));

    const { data, error } = await supabase.from('parcel_requests').insert(rows).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH set pemilik request ────────────────────────────
//  Untuk request lama yang disetor sebelum kode akses ikut tercatat.
router.patch('/:id/owner', async (req, res) => {
  const { owner_code_id } = req.body;
  const { data, error } = await supabase
    .from('parcel_requests')
    .update({ owner_code_id: owner_code_id ? parseInt(owner_code_id) : null })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH approve ────────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
  // 1. Get the request
  const { data: req_data, error: fetchErr } = await supabase
    .from('parcel_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !req_data) return res.status(404).json({ error: 'Request tidak ditemukan' });
  if (req_data.status !== 'pending') return res.status(400).json({ error: 'Request sudah diproses' });

  const parcelType = req_data.type; // 'HC' or 'WH'
  const table = parcelType === 'HC' ? 'hc_parcels' : 'wh_parcels';

  // 2. Find active batch of this type
  const { data: batch, error: batchErr } = await supabase
    .from('batches')
    .select('id')
    .eq('type', parcelType)
    .eq('status', 'active')
    .order('batch_number', { ascending: false })
    .limit(1)
    .single();

  if (batchErr || !batch) return res.status(400).json({ error: `Tidak ada batch ${parcelType} aktif` });

  // 3. Insert into parcel table
  const insertData = {
    batch_id: batch.id,
    tracking_number: req_data.tracking_number,
    recipient_name: req_data.recipient_name,
    type: req_data.parcel_type,
    co_photo_url: req_data.co_photo_url || null,
    owner_code_id: req_data.owner_code_id || null,
    currency: 'IDR',
    additional_fee: 0,
    status: 'active',
    is_manual_input: false,
    fine_amount: 0,
  };
  if (parcelType === 'HC') {
    insertData.estimated_weight_grams = 0;
    insertData.estimated_quantity = 1;
    insertData.hc_fee = 0;
  } else {
    insertData.wh_fee = 0;
  }

  const { error: insertErr } = await supabase.from(table).insert(insertData);
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // 4. Mark as approved
  const { data: updated, error: updateErr } = await supabase
    .from('parcel_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json(updated);
});

// ── PATCH reject ─────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const { data, error } = await supabase
    .from('parcel_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE request ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('parcel_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
