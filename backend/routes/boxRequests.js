const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes } = require('../lib/owner');
const { logActivity } = require('../lib/log');
const { closeBox, ensureOpenBox } = require('../lib/box');

// Permintaan tutup box dari pelanggan.
//
// Pelanggan memilih resi mana saja yang mau dikirim, mengisi alamat, lalu
// admin tinggal menyetujui. Syaratnya resi itu sudah ada foto arrival-nya
// — kalau belum, barangnya belum tentu sudah dicek, jadi tidak boleh ikut.
//
// Selama migrasi 020 belum dijalankan semua route di sini menjawab dengan
// pesan yang menyebut file SQL-nya, dan sisa aplikasi tetap jalan.
const BELUM_AKTIF =
  'Permintaan tutup box belum aktif — jalankan supabase/migrations/020_box_close_requests.sql';

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Pelanggan dikenali dari kode aksesnya, sama seperti setor resi
async function viewerOf(req) {
  const code = (req.get('X-Access-Code') || '').trim();
  if (!code) return null;
  const { data } = await supabase
    .from('access_codes').select('id, label').ilike('code', code).maybeSingle();
  return data || null;
}

async function withOwner(rows) {
  const codes = await fetchCodes();
  const byId = new Map(codes.map(c => [String(c.id), c]));
  const boxIds = [...new Set(rows.map(r => r.box_id).filter(Boolean))];
  const { data: boxes } = boxIds.length
    ? await supabase.from('boxes').select('id, name, status').in('id', boxIds)
    : { data: [] };
  const boxById = new Map((boxes || []).map(b => [String(b.id), b]));

  return rows.map(r => ({
    ...r,
    owner: byId.get(String(r.owner_code_id)) || null,
    box: boxById.get(String(r.box_id)) || null,
  }));
}

// Resi yang ikut dalam permintaan, lengkap dengan keterangan fotonya
async function parcelsOf(ids) {
  const list = (ids || []).map(Number).filter(Boolean);
  if (!list.length) return [];
  const { data } = await supabase
    .from('wh_parcels')
    .select('id, tracking_number, recipient_name, type, photo_url, box_id')
    .in('id', list);
  return data || [];
}

// ── Daftar permintaan (admin) ───────────────────────────────────────
//  ?status=pending|approved|rejected|all   (bawaan: pending)
router.get('/', async (req, res) => {
  const status = String(req.query.status || 'pending');
  let q = supabase.from('box_close_requests').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.json({ requests: [], ready: false, error: BELUM_AKTIF });

  const rows = await withOwner(data || []);
  const semuaId = [...new Set(rows.flatMap(r => r.parcel_ids || []))];
  const parcels = await parcelsOf(semuaId);
  const byId = new Map(parcels.map(p => [String(p.id), p]));

  res.json({
    ready: true,
    requests: rows.map(r => ({
      ...r,
      parcels: (r.parcel_ids || []).map(id => byId.get(String(id))).filter(Boolean),
    })),
  });
});

// Lencana di menu admin
router.get('/count', async (req, res) => {
  const { count, error } = await supabase
    .from('box_close_requests').select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  res.json({ count: error ? 0 : count || 0 });
});

// ── Milik pelanggan sendiri ─────────────────────────────────────────
router.get('/mine', async (req, res) => {
  const me = await viewerOf(req);
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  const { data, error } = await supabase
    .from('box_close_requests').select('*')
    .eq('owner_code_id', me.id)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return res.json({ requests: [], ready: false });

  res.json({ ready: true, requests: data || [] });
});

// ── Pelanggan mengajukan ────────────────────────────────────────────
router.post('/', async (req, res) => {
  const me = await viewerOf(req);
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  const ids = [...new Set((Array.isArray(req.body.parcel_ids) ? req.body.parcel_ids : []).map(Number).filter(Boolean))];
  const address = String(req.body.address || '').trim();

  if (!ids.length)  return res.status(400).json({ error: 'Pilih dulu resi yang mau dikirim' });
  if (!address)     return res.status(400).json({ error: 'Alamat pengiriman wajib diisi' });

  // Resi harus miliknya sendiri dan fotonya sudah ada — dua-duanya dicek
  // di server, jadi tidak bisa dilewati dari layar pelanggan.
  const dipilih = await parcelsOf(ids);
  const { data: milikku } = await supabase
    .from('wh_parcels').select('id').eq('owner_code_id', me.id).in('id', ids);
  const sah = new Set((milikku || []).map(p => String(p.id)));

  const bukanMilikku = dipilih.filter(p => !sah.has(String(p.id)));
  if (bukanMilikku.length || dipilih.length !== ids.length) {
    return res.status(403).json({ error: 'Ada resi yang bukan milikmu' });
  }

  const tanpaFoto = dipilih.filter(p => !p.photo_url);
  if (tanpaFoto.length) {
    return res.status(400).json({
      error: `${tanpaFoto.length} resi belum ada foto arrival — tunggu fotonya diupload admin dulu ya`,
      without_photo: tanpaFoto.map(p => p.tracking_number),
    });
  }

  // Satu permintaan yang masih menunggu sudah cukup
  const { data: nunggu } = await supabase
    .from('box_close_requests').select('id')
    .eq('owner_code_id', me.id).eq('status', 'pending').maybeSingle();
  if (nunggu) {
    return res.status(409).json({ error: 'Permintaan tutup box kamu yang sebelumnya masih ditinjau admin' });
  }

  const asuransi = req.body.insurance === true || req.body.insurance === 'true';
  const payload = {
    owner_code_id: me.id,
    box_id: dipilih[0]?.box_id || null,
    parcel_ids: ids,
    parcel_count: ids.length,
    recipient_name: String(req.body.recipient_name || '').trim() || me.label,
    phone: String(req.body.phone || '').trim() || null,
    address,
    courier: String(req.body.courier || 'general').toLowerCase() === 'sf' ? 'sf' : 'general',
    sf_ok: req.body.sf_ok === true || req.body.sf_ok === 'true',
    insurance: asuransi,
    insurance_cny: asuransi ? Math.max(0, num(req.body.insurance_cny)) : 0,
    note: String(req.body.note || '').trim() || null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('box_close_requests').insert(payload).select().single();
  if (error) return res.status(503).json({ error: BELUM_AKTIF });

  logActivity({
    action: 'box_close_request',
    summary: `${me.label} minta tutup box · ${ids.length} resi`,
    detail: `Ekspedisi ${payload.courier === 'sf' ? 'SF' : 'general'}`
      + (payload.insurance ? ` · asuransi ¥${payload.insurance_cny}` : ' · tanpa asuransi'),
    ref_type: 'box_close_request',
    ref_id: data.id,
  });

  res.json(data);
});

// ── Admin menyetujui ────────────────────────────────────────────────
//  Box yang berisi resi itu ditutup, dan box berikutnya langsung dibuat
//  supaya resi baru pelanggan punya tempat.
router.patch('/:id/approve', async (req, res) => {
  const { data: minta, error: cariErr } = await supabase
    .from('box_close_requests').select('*').eq('id', req.params.id).single();
  if (cariErr || !minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
  if (minta.status !== 'pending') return res.status(409).json({ error: 'Permintaan ini sudah diputuskan' });

  const dipilih = await parcelsOf(minta.parcel_ids);
  const tanpaFoto = dipilih.filter(p => !p.photo_url);
  if (tanpaFoto.length) {
    return res.status(400).json({
      error: `Masih ada ${tanpaFoto.length} resi tanpa foto arrival — upload dulu sebelum box ditutup`,
      without_photo: tanpaFoto.map(p => p.tracking_number),
    });
  }

  // Resi yang tidak ikut dipilih tidak boleh ikut tertutup: dipindahkan
  // lebih dulu ke box berikutnya.
  const boxId = minta.box_id || dipilih[0]?.box_id || null;
  let pindah = 0;
  if (boxId) {
    const ikut = new Set((minta.parcel_ids || []).map(String));
    const { data: isiBox } = await supabase
      .from('wh_parcels').select('id').eq('box_id', boxId);
    const sisa = (isiBox || []).filter(p => !ikut.has(String(p.id))).map(p => p.id);

    if (sisa.length) {
      await supabase.from('wh_parcels').update({ box_id: null }).in('id', sisa);
      pindah = sisa.length;
    }
    await closeBox(boxId);
    // Box berikutnya dibuat sekaligus mengambil resi yang barusan dilepas
    await ensureOpenBox(minta.owner_code_id);
  }

  const { data, error } = await supabase
    .from('box_close_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      admin_note: String(req.body.admin_note || '').trim() || null,
    })
    .eq('id', minta.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const codes = await fetchCodes();
  const label = codes.find(c => String(c.id) === String(minta.owner_code_id))?.label || 'pelanggan';
  logActivity({
    action: 'box_close_approved',
    summary: `Permintaan tutup box ${label} disetujui · ${minta.parcel_count} resi`,
    detail: pindah ? `${pindah} resi yang tidak ikut dipindah ke box berikutnya` : null,
    ref_type: 'box_close_request',
    ref_id: minta.id,
  });

  res.json({ ...data, moved: pindah });
});

// ── Admin menolak ───────────────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const { data, error } = await supabase
    .from('box_close_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      admin_note: String(req.body.admin_note || '').trim() || null,
    })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(503).json({ error: BELUM_AKTIF });

  logActivity({
    action: 'box_close_rejected',
    summary: `Permintaan tutup box ditolak`,
    detail: data.admin_note,
    ref_type: 'box_close_request',
    ref_id: data.id,
  });

  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('box_close_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
