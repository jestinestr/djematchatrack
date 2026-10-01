const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase');
const { fetchCodes, attachOwners } = require('../lib/owner');
const { logActivity } = require('../lib/log');
const { activePackageId, packageHasRoom } = require('../lib/packages');
const { getSetting } = require('../lib/settings');
const { hasColumn } = require('../lib/columns');

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
// ── Cek nomor resi sebelum disetor ──────────────────────────────────
//  Mencegah resi yang sama disetor dua kali. Jawabannya dipakai form
//  pelanggan untuk memberi peringatan sebelum tombol kirim ditekan.
//
//  status tiap nomor:
//    new     → belum ada di mana pun, aman disetor
//    parcel  → resinya sudah tercatat di sistem
//    pending → sudah pernah disetor dan masih menunggu di-acc admin
async function lookupTracking(list) {
  const clean = [...new Set(list.map(t => String(t || '').trim()).filter(Boolean))];
  if (!clean.length) return new Map();

  const columns = 'tracking_number, recipient_name, type, created_at, owner_code_id';
  const [hc, wh, pend] = await Promise.all([
    supabase.from('hc_parcels').select(columns).in('tracking_number', clean),
    supabase.from('wh_parcels').select(columns).in('tracking_number', clean),
    supabase.from('parcel_requests')
      .select('tracking_number, recipient_name, type, created_at, owner_code_id, status')
      .in('tracking_number', clean).eq('status', 'pending'),
  ]);

  const out = new Map();
  for (const row of hc.data || []) out.set(row.tracking_number, { status: 'parcel', kind: 'HC', ...row });
  for (const row of wh.data || []) out.set(row.tracking_number, { status: 'parcel', kind: 'WH', ...row });
  for (const row of pend.data || []) {
    if (!out.has(row.tracking_number)) {
      out.set(row.tracking_number, { status: 'pending', kind: row.type, ...row });
    }
  }
  return out;
}

// Kolom kind lahir dari migrasi 016; sebelum itu dijalankan, fieldnya
// dibuang supaya setor resi tetap bisa jalan seperti biasa.
async function stripKind(rows) {
  if (await hasColumn('parcel_requests', 'kind')) return rows;
  return rows.map(({ kind, ...rest }) => rest);
}

router.post('/check', async (req, res) => {
  const list = Array.isArray(req.body.tracking_numbers) ? req.body.tracking_numbers : [];
  const rawCode = (req.get('X-Access-Code') || '').trim();
  if (!rawCode) return res.status(401).json({ error: 'Kode akses tidak dikirim' });

  try {
    const { data: me } = await supabase
      .from('access_codes').select('id').ilike('code', rawCode).single();
    if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

    const found = await lookupTracking(list);
    const result = list.map(t => {
      const key = String(t || '').trim();
      const hit = found.get(key);
      if (!key || !hit) return { tracking_number: key, status: 'new' };
      return {
        tracking_number: key,
        status: hit.status,
        kind: hit.kind,
        // Nama penerima hanya dibuka kalau resinya memang milik dia sendiri,
        // supaya nomor resi orang lain tidak bisa diintip lewat form ini.
        mine: String(hit.owner_code_id || '') === String(me.id),
        recipient_name: String(hit.owner_code_id || '') === String(me.id) ? hit.recipient_name : null,
        created_at: hit.created_at,
      };
    });
    res.json({ results: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', upload.any(), async (req, res) => {
  const { type, items: itemsJson } = req.body;

  // Siapa yang menyetor — diambil dari kode akses di header, bukan dari body,
  // supaya pengirim tidak bisa mengaku-aku sebagai pelanggan lain.
  const rawCode = (req.get('X-Access-Code') || '').trim();
  if (!rawCode) return res.status(401).json({ error: 'Kode akses tidak dikirim' });

  const { data: codeRow } = await supabase
    .from('access_codes').select('id, label').ilike('code', rawCode).single();
  if (!codeRow) return res.status(401).json({ error: 'Kode akses tidak valid' });

  const ownerCodeId = codeRow.id;
  // Nama penerima tidak lagi diketik user — pakai nama pemilik kode akses
  // supaya kepemilikan tidak bisa dikarang dari isian bebas.
  const ownerLabel = codeRow.label;

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
    if (!item.tracking_number?.trim()) {
      return res.status(400).json({ error: `Baris ${i + 1}: nomor resi wajib diisi` });
    }
    if (item.parcel_type === 'paperbased' && !(parseInt(item.quantity) >= 1)) {
      return res.status(400).json({ error: `Baris ${i + 1}: jumlah paperbased wajib diisi` });
    }
  }

  try {
    // Permintaan perbaikan butuh kolom `kind` untuk membedakannya dari resi
    // baru. Tanpa itu, setoran perbaikan akan terbaca sebagai resi baru dan
    // membuat resi dobel saat di-acc — jadi lebih baik ditolak terang-terangan.
    if (items.some(it => it.kind === 'fix') && !(await hasColumn('parcel_requests', 'kind'))) {
      return res.status(503).json({
        error: 'Permintaan perbaikan belum aktif — minta admin menjalankan supabase/migrations/016_auto_acc_and_fix_request.sql',
      });
    }

    // Resi yang sudah tercatat tidak boleh disetor ulang. Pelanggan yang
    // datanya keliru menandai barisnya sebagai permintaan perbaikan, dan
    // baris itu memang boleh memakai nomor yang sudah ada.
    const baru = items.filter(it => it.kind !== 'fix').map(it => it.tracking_number.trim());
    const sudahAda = await lookupTracking(baru);
    const kembar = baru.filter(t => sudahAda.has(t));
    if (kembar.length) {
      return res.status(409).json({
        error: `Resi ${kembar.join(', ')} sudah pernah masuk. Hapus dari daftar, atau tandai sebagai perbaikan kalau datanya ada yang keliru.`,
        duplicates: kembar,
      });
    }

    // Upload CO photos & build rows
    const rows = await Promise.all(items.map(async (item, i) => ({
      type,
      tracking_number: item.tracking_number.trim(),
      // Penerima opsional (bisa beda orang di akun yang sama); kosong = nama pemilik
      recipient_name: item.recipient_name?.trim() || ownerLabel,
      parcel_type: item.parcel_type || 'barang',
      notes: item.notes?.trim() || null,
      co_photo_url: await uploadPhoto(coPhotoFiles[i] || null),
      owner_code_id: ownerCodeId,
      need_unboxing: type === 'WH' && !!item.need_unboxing,
      freebies_stay: !!item.freebies_stay,
      quantity: item.parcel_type === 'paperbased' ? parseInt(item.quantity) || null : null,
      kind: item.kind === 'fix' ? 'fix' : 'new',
      status: 'pending',
    })));

    const { data, error } = await supabase.from('parcel_requests').insert(await stripKind(rows)).select();
    if (error) return res.status(500).json({ error: error.message });

    // Mode auto ACC: setoran resi baru langsung jadi resi tanpa menunggu
    // admin. Permintaan perbaikan tetap manual — itu butuh mata manusia.
    let approved = 0;
    if (await getSetting('auto_approve_requests')) {
      for (const row of data) {
        if (row.kind === 'fix') continue;
        const result = await approveRequest(row.id);
        if (!result.error) approved += 1;
      }
    }

    res.json({ requests: data, auto_approved: approved });
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

  const { data: owner } = await supabase
    .from('access_codes').select('label').eq('id', data.owner_code_id).single();

  logActivity({
    action: 'request_owner',
    summary: `Setoran resi ${data.tracking_number} ditandai milik ${owner?.label || 'tanpa pemilik'}`,
    ref_type: 'request',
    ref_id: data.id,
  });

  res.json(data);
});

// ── PATCH approve ────────────────────────────────────────
// Proses acc satu setoran: buat resinya, lalu tandai setorannya disetujui.
// Dipakai tombol Acc di panel admin maupun mode auto ACC — jalurnya sama
// supaya hasilnya tidak pernah beda.
async function approveRequest(id) {
  const { data: reqData, error: fetchErr } = await supabase
    .from('parcel_requests').select('*').eq('id', id).single();

  if (fetchErr || !reqData) return { error: 'Request tidak ditemukan', code: 404 };
  if (reqData.status !== 'pending') return { error: 'Request sudah diproses', code: 400 };

  // Permintaan perbaikan tidak membuat resi baru — admin yang membetulkan
  // datanya, setorannya cukup ditandai selesai.
  if (reqData.kind === 'fix') {
    const { data: done, error: doneErr } = await supabase
      .from('parcel_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (doneErr) return { error: doneErr.message, code: 500 };

    logActivity({
      action: 'request_approve',
      summary: `Tandai selesai permintaan perbaikan ${reqData.tracking_number} (${reqData.recipient_name})`,
      detail: reqData.notes || null,
      ref_type: 'request',
      ref_id: reqData.id,
    });
    return { data: done };
  }

  const parcelType = reqData.type; // 'HC' atau 'WH'
  const table = parcelType === 'HC' ? 'hc_parcels' : 'wh_parcels';

  const { data: batch, error: batchErr } = await supabase
    .from('batches').select('*')
    .eq('type', parcelType).eq('status', 'active')
    .order('batch_number', { ascending: false }).limit(1).single();

  if (batchErr || !batch) return { error: `Tidak ada batch ${parcelType} aktif`, code: 400 };

  const insertData = {
    batch_id: batch.id,
    tracking_number: reqData.tracking_number,
    recipient_name: reqData.recipient_name,
    type: reqData.parcel_type,
    co_photo_url: reqData.co_photo_url || null,
    owner_code_id: reqData.owner_code_id || null,
    currency: 'IDR',
    additional_fee: 0,
    status: 'active',
    is_manual_input: false,
    fine_amount: 0,
    freebies_stay: !!reqData.freebies_stay,
  };

  if (parcelType === 'HC') {
    insertData.estimated_weight_grams = 0;
    insertData.estimated_quantity = reqData.quantity || 1;
    insertData.hc_fee = 0;
  } else {
    insertData.need_unboxing = !!reqData.need_unboxing;
    insertData.estimated_quantity = reqData.quantity || 1;
    insertData.unboxing_fee = reqData.need_unboxing ? Number(batch.unboxing_fee ?? 0.75) : 0;
    if (reqData.owner_code_id) {
      const { data: openBox } = await supabase
        .from('boxes').select('id')
        .eq('owner_code_id', reqData.owner_code_id).eq('status', 'open')
        .order('created_at', { ascending: false }).limit(1);
      if (openBox?.[0]) insertData.box_id = openBox[0].id;
    }
    const pkgId = await activePackageId(reqData.owner_code_id);
    if (pkgId) insertData.package_id = pkgId; // masuk paket aktif pelanggan
    // Biaya WH otomatis: tercover paket kalau masih ada jatah, selain itu satuan
    const covered = pkgId ? await packageHasRoom(pkgId) : false;
    insertData.currency = 'CNY';
    insertData.wh_fee = covered ? 0 : Number(batch.unit_fee ?? 1.5);
  }

  const { error: insertErr } = await supabase.from(table).insert(insertData);
  if (insertErr) return { error: insertErr.message, code: 500 };

  const { data: updated, error: updateErr } = await supabase
    .from('parcel_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id).select().single();

  if (updateErr) return { error: updateErr.message, code: 500 };

  logActivity({
    action: 'request_approve',
    summary: `Acc setoran resi ${reqData.tracking_number} (${reqData.recipient_name}) → Batch ${parcelType} #${batch.batch_number}`,
    ref_type: 'request',
    ref_id: reqData.id,
  });

  return { data: updated };
}

router.patch('/:id/approve', async (req, res) => {
  const result = await approveRequest(req.params.id);
  if (result.error) return res.status(result.code || 500).json({ error: result.error });
  res.json(result.data);
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

  logActivity({
    action: 'request_reject',
    summary: `Tolak setoran resi ${data.tracking_number} (${data.recipient_name})`,
    ref_type: 'request',
    ref_id: data.id,
  });

  res.json(data);
});

// ── DELETE request ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('parcel_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
