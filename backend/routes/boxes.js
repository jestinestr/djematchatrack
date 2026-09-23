const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes } = require('../lib/owner');
const { logActivity } = require('../lib/log');

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

  const [withOwner] = await withOwners([data]);
  logActivity({
    action: 'box_add',
    summary: `Buat box ${boxLabel(data, withOwner.owner?.label)}`,
    ref_type: 'box',
    ref_id: data.id,
  });
  res.json(withOwner);
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

  const [withOwner] = await withOwners([data]);
  logActivity({
    action: 'box_close',
    summary: `Tutup box ${boxLabel(data, withOwner.owner?.label)}`,
    detail: 'Box beserta resinya pindah ke arsip pelanggan',
    ref_type: 'box',
    ref_id: data.id,
  });
  res.json(withOwner);
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
