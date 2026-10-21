const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes } = require('../lib/owner');
const { logActivity } = require('../lib/log');
const { ensureOpenBox } = require('../lib/box');
const { hasColumn } = require('../lib/columns');

// Label yang dipakai di mana-mana: "BosBesar - Box 1"
const boxLabel = (box, ownerLabel) => `${ownerLabel || '—'} - ${box.name}`;

async function withOwners(boxes) {
  const codes = await fetchCodes();
  return (boxes || []).map(b => {
    const c = codes.find(x => String(x.id) === String(b.owner_code_id));
    return { ...b, owner: c ? { id: c.id, label: c.label, code: c.code } : null };
  });
}

// ── Daftar box + jumlah resinya ─────────────────────────────────────
//  ?status=open|closed|all  ?owner=<code id>
router.get('/', async (req, res) => {
  const { status = 'all', owner } = req.query;

  let q = supabase.from('boxes').select('*').order('created_at', { ascending: false });
  if (status !== 'all') q = q.eq('status', status);
  if (owner) q = q.eq('owner_code_id', owner);

  const [{ data: boxes, error }, { data: rows }] = await Promise.all([
    q,
    supabase.from('wh_parcels').select('id, box_id').not('box_id', 'is', null),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const counts = new Map();
  for (const r of rows || []) {
    counts.set(String(r.box_id), (counts.get(String(r.box_id)) || 0) + 1);
  }

  const list = (await withOwners(boxes)).map(b => ({ ...b, parcel_count: counts.get(String(b.id)) || 0 }));
  list.sort((a, b) =>
    (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1) ||
    (a.owner?.label || '').localeCompare(b.owner?.label || '', 'id') ||
    a.name.localeCompare(b.name, 'id', { numeric: true })
  );
  res.json(list);
});

// ── Buat box baru untuk pelanggan ───────────────────────────────────
router.post('/', async (req, res) => {
  const { owner_code_id, name, note } = req.body;
  if (!owner_code_id || !name?.trim()) {
    return res.status(400).json({ error: 'Pelanggan dan nama box wajib diisi' });
  }

  // Nama box unik per pelanggan
  const { data: same } = await supabase
    .from('boxes').select('id, name').eq('owner_code_id', owner_code_id);
  if ((same || []).some(b => b.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    return res.status(409).json({ error: `Box "${name.trim()}" sudah ada untuk pelanggan ini` });
  }

  const { data, error } = await supabase
    .from('boxes')
    .insert({ owner_code_id: parseInt(owner_code_id), name: name.trim(), note: note?.trim() || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Resi pelanggan ini yang sedang menggantung tanpa box langsung ikut masuk.
  // Ini yang terjadi pada resi yang tidak kebagian box waktu box lama ditutup:
  // begitu box baru dibuka, mereka pindah sendiri.
  const { data: loose } = await supabase
    .from('wh_parcels').select('id')
    .eq('owner_code_id', data.owner_code_id).is('box_id', null);
  const adopted = (loose || []).map(p => p.id);
  if (adopted.length) {
    await supabase.from('wh_parcels').update({ box_id: data.id }).in('id', adopted);
  }

  const [withOwner] = await withOwners([data]);
  logActivity({
    action: 'box_add',
    summary: `Buat box ${boxLabel(data, withOwner.owner?.label)}`,
    detail: adopted.length ? `${adopted.length} resi tanpa box ikut dimasukkan` : null,
    ref_type: 'box',
    ref_id: data.id,
  });
  res.json({ ...withOwner, adopted: adopted.length });
});

// ── Ubah nama / catatan box ─────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const updates = {};
  if (req.body.name?.trim()) updates.name = req.body.name.trim();
  if (req.body.note !== undefined) updates.note = req.body.note?.trim() || null;
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Tidak ada perubahan' });

  const { data, error } = await supabase
    .from('boxes').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const [withOwner] = await withOwners([data]);
  res.json(withOwner);
});

// ── Tutup box → masuk arsip pelanggan ───────────────────────────────
router.post('/:id/close', async (req, res) => {
  const { data, error } = await supabase
    .from('boxes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Resi di dalamnya ikut ditandai arsip, namanya tetap sama
  await supabase.from('wh_parcels').update({ status: 'archived' }).eq('box_id', data.id);

  // Box yang ditutup berarti barangnya sudah dikirim, jadi tidak boleh
  // kemasukan resi baru. Box berikutnya langsung disiapkan di sini supaya
  // admin melihatnya sekarang, bukan baru muncul waktu resi berikut datang.
  const nextId = await ensureOpenBox(data.owner_code_id);
  const { data: nextBox } = nextId
    ? await supabase.from('boxes').select('id, name').eq('id', nextId).single()
    : { data: null };

  const [withOwner] = await withOwners([data]);
  logActivity({
    action: 'box_close',
    summary: `Tutup box ${boxLabel(data, withOwner.owner?.label)}`,
    detail: nextBox
      ? `Resinya pindah ke arsip; resi berikutnya masuk ${nextBox.name}`
      : 'Box beserta resinya pindah ke arsip pelanggan',
    ref_type: 'box',
    ref_id: data.id,
  });
  res.json({ ...withOwner, next_box: nextBox });
});

// ── Buka lagi box yang tertutup ─────────────────────────────────────
router.post('/:id/reopen', async (req, res) => {
  const { data, error } = await supabase
    .from('boxes')
    .update({ status: 'open', closed_at: null })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('wh_parcels').update({ status: 'active' }).eq('box_id', data.id);

  const [withOwner] = await withOwners([data]);
  logActivity({
    action: 'box_reopen',
    summary: `Buka lagi box ${boxLabel(data, withOwner.owner?.label)}`,
    ref_type: 'box',
    ref_id: data.id,
  });
  res.json(withOwner);
});

// ── Checklist packing ───────────────────────────────────────────────
//
//  Dipakai saat isi box dimasukkan ke kardus satu per satu: tiap resi
//  dicentang kalau barangnya sudah benar-benar masuk, jadi yang ketinggalan
//  ketahuan sebelum boxnya berangkat.
const PACK_BELUM_AKTIF =
  'Checklist packing belum aktif — jalankan supabase/migrations/022_packing_checklist.sql';

router.get('/:id/packlist', async (req, res) => {
  const siap = await hasColumn('wh_parcels', 'packed_at');
  const kolom = 'id, tracking_number, recipient_name, type, photo_url, estimated_quantity'
    + (siap ? ', packed_at' : '');

  const [{ data: box }, { data: rows, error }] = await Promise.all([
    supabase.from('boxes').select('id, name, status, owner_code_id').eq('id', req.params.id).single(),
    supabase.from('wh_parcels').select(kolom).eq('box_id', req.params.id).order('id'),
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const withOwner = (await withOwners(box ? [box] : []))[0] || null;
  const parcels = (rows || []).map(p => ({ ...p, packed_at: siap ? p.packed_at : null }));

  res.json({
    ready: siap,
    error: siap ? null : PACK_BELUM_AKTIF,
    box: withOwner,
    parcels,
    packed: parcels.filter(p => p.packed_at).length,
    total: parcels.length,
  });
});

//  body { ids: [...], packed: true|false }
router.post('/:id/pack', async (req, res) => {
  if (!(await hasColumn('wh_parcels', 'packed_at'))) {
    return res.status(503).json({ error: PACK_BELUM_AKTIF });
  }
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Tidak ada resi yang dipilih' });

  const masuk = req.body.packed !== false;
  const { error } = await supabase
    .from('wh_parcels')
    .update({ packed_at: masuk ? new Date().toISOString() : null })
    .in('id', ids).eq('box_id', req.params.id);   // hanya resi di box ini
  if (error) return res.status(500).json({ error: error.message });

  // Satu catatan saja per aksi borongan, bukan per resi
  if (ids.length > 1) {
    const { data: box } = await supabase
      .from('boxes').select('id, name, owner_code_id').eq('id', req.params.id).single();
    const label = (await withOwners(box ? [box] : []))[0];
    logActivity({
      action: 'box_pack',
      summary: `${ids.length} resi ditandai ${masuk ? 'sudah' : 'belum'} masuk ${label ? boxLabel(label, label.owner?.label) : 'box'}`,
      ref_type: 'box',
      ref_id: req.params.id,
    });
  }

  res.json({ success: true, updated: ids.length, packed: masuk });
});

// ── Hapus box (hanya kalau kosong) ──────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { count } = await supabase
    .from('wh_parcels').select('id', { count: 'exact', head: true }).eq('box_id', req.params.id);
  if (count) return res.status(400).json({ error: `Box masih berisi ${count} resi` });

  const { error } = await supabase.from('boxes').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Pindahkan resi ke box lain ──────────────────────────────────────
router.post('/move', async (req, res) => {
  const { parcel_ids, box_id } = req.body;
  if (!Array.isArray(parcel_ids) || !parcel_ids.length) {
    return res.status(400).json({ error: 'Pilih resi dulu' });
  }
  const { error } = await supabase
    .from('wh_parcels').update({ box_id: box_id || null }).in('id', parcel_ids);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, moved: parcel_ids.length });
});

module.exports = { router, boxLabel };
