const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../supabase');
const { uploadPhoto } = require('../lib/storage');
const { fetchCodes, norm } = require('../lib/owner');
const { logActivity, parcelLabel } = require('../lib/log');
const { hasColumn } = require('../lib/columns');

const TABLE = { hc: 'hc_parcels', wh: 'wh_parcels' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB — batas Vercel
});

// ── Tandai foto sudah diunduh ───────────────────────────────────────
//  body: { kind: 'hc'|'wh', ids: [...] }
//  Admin  : POST /api/photos/downloaded
//  Pelanggan: POST /api/photos/downloaded/mine (header X-Access-Code),
//             hanya boleh menandai resi miliknya sendiri.
async function mark(table, ids, column) {
  const { error } = await supabase
    .from(table)
    .update({ [column]: new Date().toISOString() })
    .in('id', ids);
  return error;
}

router.post('/downloaded', async (req, res) => {
  const { kind, ids } = req.body;
  const table = TABLE[String(kind).toLowerCase()];
  if (!table || !Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }
  const error = await mark(table, ids, 'photo_dl_admin');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/downloaded/mine', async (req, res) => {
  const { kind, ids } = req.body;
  const table = TABLE[String(kind).toLowerCase()];
  if (!table || !Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  const rawCode = (req.get('X-Access-Code') || '').trim();
  const codes = await fetchCodes();
  const me = codes.find(c => norm(c.code) === norm(rawCode));
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  // Hanya resi milik pelanggan ini yang boleh ditandai
  const { data: mine } = await supabase
    .from(table).select('id').in('id', ids).eq('owner_code_id', me.id);
  const allowed = (mine || []).map(r => r.id);
  if (!allowed.length) return res.json({ success: true, marked: 0 });

  const error = await mark(table, allowed, 'photo_dl_user');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, marked: allowed.length });
});

// ── Panel Upload Foto ───────────────────────────────────────────────
//  Route di bawah ini sengaja dibuat sempit: hanya menyentuh kolom foto
//  dan segelintir kolom data dasar. Berbeda dengan PATCH /api/parcels/:kind
//  yang menulis ulang SELURUH payload (biaya, denda, mata uang) — itu tidak
//  aman dipanggil dari layar ponsel yang tidak menampilkan kolom biaya.

const SLOT = { photo: 'photo_url', co: 'co_photo_url' };
const SLOT_LABEL = { photo_url: 'foto arrival', co_photo_url: 'foto CO' };

// Kolom yang boleh diubah dari panel foto
const EDITABLE = {
  tracking_number:        v => String(v).trim(),
  recipient_name:         v => String(v).trim(),
  estimated_quantity:     v => Math.max(1, parseInt(v) || 1),
  estimated_weight_grams: v => Math.max(0, parseInt(v) || 0),
  owner_code_id:          v => (v === '' || v == null ? null : parseInt(v)),
};

// box_id dan need_unboxing hanya ada di wh_parcels (video unboxing memang
// khusus Warehouse). need_unboxing penting dibawa ke panel foto: paket itu
// harus direkam dulu, jangan sampai keburu dibuka.
const BASE_COLUMNS = 'id, batch_id, tracking_number, recipient_name, owner_code_id, type, estimated_quantity, estimated_weight_grams, photo_url, co_photo_url, photo_uploaded_at, created_at';

// Kolom penanda urutan hanya diminta kalau migrasi 013 sudah dijalankan,
// kalau tidak querynya gagal total dan daftar resi ikut kosong.
async function columnsFor(kind) {
  const cols = [BASE_COLUMNS];
  if (kind === 'wh') cols.push('box_id', 'need_unboxing');
  if (await hasColumn(TABLE[kind], 'open_order')) cols.push('open_order', 'open_printed');
  return cols.join(', ');
}

const kindOf = v => (TABLE[String(v || '').toLowerCase()] ? String(v).toLowerCase() : null);

// Daftar resi untuk dikerjakan: gabungan HC + WH, terbaru di atas.
//  ?q=          cari nomor resi / nama penerima / nama pelanggan
//  ?missing=1   hanya yang belum ada foto arrival
//  ?unboxing=1  hanya yang diminta video unboxing (otomatis WH saja)
//  ?kind=hc|wh
router.get('/worklist', async (req, res) => {
  const q = (req.query.q || '').trim();
  const missing = req.query.missing === '1' || req.query.missing === 'true';
  const unboxing = req.query.unboxing === '1' || req.query.unboxing === 'true';
  const only = kindOf(req.query.kind);
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);

  try {
    // Unboxing cuma ada di WH, jadi HC tidak perlu ditanyakan sama sekali
    const kinds = (unboxing ? ['wh'] : ['hc', 'wh']).filter(k => !only || k === only);

    const [codes, batchRes, boxRes] = await Promise.all([
      fetchCodes(),
      supabase.from('batches').select('id, type, batch_number, status'),
      supabase.from('boxes').select('id, name, status'),
    ]);
    const batches = new Map((batchRes.data || []).map(b => [String(b.id), b]));
    const boxes = new Map((boxRes.data || []).map(b => [String(b.id), b]));

    const decorate = (rows, kind) => (rows || []).map(p => {
      const owner = codes.find(c => String(c.id) === String(p.owner_code_id));
      const batch = batches.get(String(p.batch_id));
      const box = boxes.get(String(p.box_id));
      return {
        ...p,
        kind,
        owner: owner ? { id: owner.id, label: owner.label, code: owner.code } : null,
        batch: batch ? { id: batch.id, number: batch.batch_number, status: batch.status } : null,
        box: box ? { id: box.id, name: box.name, status: box.status } : null,
      };
    });

    const columns = Object.fromEntries(await Promise.all(
      kinds.map(async kind => [kind, await columnsFor(kind)])
    ));

    const baseQuery = kind => {
      let query = supabase
        .from(TABLE[kind]).select(columns[kind])
        .order('created_at', { ascending: false })
        .limit(limit);
      if (missing) query = query.is('photo_url', null);
      if (unboxing && kind === 'wh') query = query.eq('need_unboxing', true);
      return query;
    };

    const lists = await Promise.all(kinds.map(async kind => {
      let query = baseQuery(kind);
      if (q) query = query.or(`tracking_number.ilike.%${q}%,recipient_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return decorate(data, kind);
    }));

    const rows = lists.flat();

    // Pencarian juga mengenali nama/kode pelanggan, supaya resi yang nama
    // penerimanya berbeda tetap ketemu lewat pemiliknya.
    if (q) {
      const hit = codes.filter(c => norm(c.label).includes(norm(q)) || norm(c.code).includes(norm(q)));
      if (hit.length) {
        const seen = new Set(rows.map(r => `${r.kind}-${r.id}`));
        const extra = await Promise.all(kinds.map(async kind => {
          const { data } = await baseQuery(kind).in('owner_code_id', hit.map(c => c.id));
          return decorate(data, kind);
        }));
        for (const r of extra.flat()) {
          const key = `${r.kind}-${r.id}`;
          if (!seen.has(key)) { seen.add(key); rows.push(r); }
        }
      }
    }

    rows.sort(byOpenOrder);
    res.json({ parcels: rows.slice(0, limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Penanda urutan bongkar paket ────────────────────────────────────
//  Nomornya dipakai untuk mencocokkan foto arrival dengan resinya. Disimpan
//  di database (bukan browser) supaya nomor yang ditandai dari PC kelihatan
//  juga waktu upload foto dari HP.
//
//  Urutan tampil: yang sudah ditandai naik ke atas sesuai nomornya, sisanya
//  menyusul dari yang terbaru.
function byOpenOrder(a, b) {
  const ao = a.open_order ?? null;
  const bo = b.open_order ?? null;
  if (ao !== null && bo !== null) return ao - bo;
  if (ao !== null) return -1;
  if (bo !== null) return 1;
  return new Date(b.created_at) - new Date(a.created_at);
}

async function openMarkReady(res) {
  if (await hasColumn('wh_parcels', 'open_order')) return true;
  res.status(503).json({
    error: 'Penanda urutan belum aktif — jalankan supabase/migrations/013_open_order.sql di Supabase',
  });
  return false;
}

// Nomor berikutnya dihitung di server supaya dua alat tidak dapat nomor kembar
async function nextOpenNumber() {
  const tops = await Promise.all(['hc', 'wh'].map(async kind => {
    const { data } = await supabase
      .from(TABLE[kind]).select('open_order')
      .not('open_order', 'is', null)
      .order('open_order', { ascending: false })
      .limit(1);
    return data?.[0]?.open_order || 0;
  }));
  return Math.max(0, ...tops) + 1;
}

// Nomor dilepas begitu label tercetak DAN foto arrival sudah masuk
async function clearIfDone(table, id) {
  if (!(await hasColumn(table, 'open_order'))) return;
  const { data } = await supabase
    .from(table).select('open_order, open_printed, photo_url').eq('id', id).single();
  if (!data || data.open_order === null) return;
  if (data.open_printed && data.photo_url) {
    await supabase.from(table).update({ open_order: null, open_printed: false }).eq('id', id);
  }
}

router.post('/mark', async (req, res) => {
  const kind = kindOf(req.body.kind);
  if (!kind || !req.body.id) return res.status(400).json({ error: 'Data tidak valid' });
  if (!(await openMarkReady(res))) return;

  const { data, error } = await supabase
    .from(TABLE[kind]).update({ open_order: await nextOpenNumber() })
    .eq('id', req.body.id).select('id, open_order, open_printed').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, kind });
});

// Tandai labelnya sudah dicetak; kalau fotonya sudah ada, nomornya langsung lepas
router.post('/mark/printed', async (req, res) => {
  const kind = kindOf(req.body.kind);
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!kind || !ids.length) return res.status(400).json({ error: 'Data tidak valid' });
  if (!(await hasColumn(TABLE[kind], 'open_order'))) return res.json({ success: true, skipped: true });

  const { error } = await supabase
    .from(TABLE[kind]).update({ open_printed: true })
    .in('id', ids).not('open_order', 'is', null);
  if (error) return res.status(500).json({ error: error.message });

  await Promise.all(ids.map(id => clearIfDone(TABLE[kind], id)));
  res.json({ success: true });
});

router.delete('/mark/:kind/:id', async (req, res) => {
  const kind = kindOf(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Jenis resi tidak dikenal' });
  if (!(await openMarkReady(res))) return;

  const { error } = await supabase
    .from(TABLE[kind]).update({ open_order: null, open_printed: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Buang semua penanda sekaligus ("Reset semua" di tabel WH)
router.delete('/mark', async (req, res) => {
  if (!(await openMarkReady(res))) return;
  await Promise.all(['hc', 'wh'].map(kind =>
    supabase.from(TABLE[kind]).update({ open_order: null, open_printed: false })
      .not('open_order', 'is', null)
  ));
  res.json({ success: true });
});

// Unggah / ganti satu foto saja.
//  multipart: file field `photo`, body { kind, id, slot: 'photo'|'co' }
router.post('/upload', upload.single('photo'), async (req, res) => {
  const kind = kindOf(req.body.kind);
  const id = req.body.id;
  const column = SLOT[String(req.body.slot || 'photo').toLowerCase()];

  if (!kind || !id || !column) return res.status(400).json({ error: 'Data tidak valid' });
  if (!req.file) return res.status(400).json({ error: 'Foto tidak terkirim' });

  try {
    const url = await uploadPhoto(req.file);
    const updates = { [column]: url };
    // Hitungan hari simpan dimulai dari foto arrival, sama seperti form admin
    if (column === 'photo_url') updates.photo_uploaded_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(TABLE[kind]).update(updates).eq('id', id)
      .select('id, tracking_number, recipient_name, photo_url, co_photo_url, photo_uploaded_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    logActivity({
      action: 'parcel_photo',
      summary: `Upload ${SLOT_LABEL[column]} ${parcelLabel(data, data.recipient_name)}`,
      ref_type: `${kind}_parcel`,
      ref_id: data.id,
    });

    if (column === 'photo_url') await clearIfDone(TABLE[kind], data.id);

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Edit ringan dari panel foto — hanya kolom pada EDITABLE yang disentuh,
// kolom biaya/denda dibiarkan apa adanya.
router.patch('/:kind/:id', async (req, res) => {
  const kind = kindOf(req.params.kind);
  if (!kind) return res.status(400).json({ error: 'Jenis resi tidak dikenal' });

  const updates = {};
  for (const [field, clean] of Object.entries(EDITABLE)) {
    if (req.body[field] === undefined) continue;
    updates[field] = clean(req.body[field]);
  }
  if (updates.tracking_number === '') {
    return res.status(400).json({ error: 'Nomor resi tidak boleh kosong' });
  }
  if (updates.recipient_name === '') {
    return res.status(400).json({ error: 'Nama penerima tidak boleh kosong' });
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Tidak ada yang diubah' });

  const { data, error } = await supabase
    .from(TABLE[kind]).update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const codes = await fetchCodes();
  const owner = codes.find(c => String(c.id) === String(data.owner_code_id));

  logActivity({
    action: 'parcel_edit',
    summary: `Edit resi ${parcelLabel(data, owner?.label)} dari panel foto`,
    ref_type: `${kind}_parcel`,
    ref_id: data.id,
  });

  res.json({
    ...data,
    kind,
    owner: owner ? { id: owner.id, label: owner.label, code: owner.code } : null,
  });
});

// Hapus satu foto (mis. salah ambil gambar)
router.delete('/:kind/:id/:slot', async (req, res) => {
  const kind = kindOf(req.params.kind);
  const column = SLOT[String(req.params.slot).toLowerCase()];
  if (!kind || !column) return res.status(400).json({ error: 'Data tidak valid' });

  const updates = { [column]: null };
  if (column === 'photo_url') updates.photo_uploaded_at = null;

  const { data, error } = await supabase
    .from(TABLE[kind]).update(updates).eq('id', req.params.id)
    .select('id, tracking_number, recipient_name, photo_url, co_photo_url, photo_uploaded_at')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: 'parcel_photo',
    summary: `Hapus ${SLOT_LABEL[column]} ${parcelLabel(data, data.recipient_name)}`,
    ref_type: `${kind}_parcel`,
    ref_id: data.id,
  });

  res.json(data);
});

module.exports = router;
