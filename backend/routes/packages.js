const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { loadPackageInfo } = require('../lib/packages');
const { fetchCodes } = require('../lib/owner');
const { logActivity } = require('../lib/log');

const quotaOf = v => Math.max(1, parseInt(v) || 0);

// ── Semua paket + pemakaiannya ──────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [{ packages }, codes] = await Promise.all([loadPackageInfo(), fetchCodes()]);
    const withOwner = packages.map(p => {
      const c = codes.find(x => String(x.id) === String(p.owner_code_id));
      return { ...p, owner: c ? { id: c.id, label: c.label, code: c.code } : null };
    });
    withOwner.sort((a, b) =>
      (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1) ||
      (a.owner?.label || '').localeCompare(b.owner?.label || '', 'id') ||
      b.period_no - a.period_no
    );
    res.json(withOwner);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Buat paket baru untuk pelanggan ─────────────────────────────────
//  include_existing: resi WH pelanggan yang belum masuk paket ikut dihitung
router.post('/', async (req, res) => {
  const { owner_code_id, name, quota, price, include_existing } = req.body;
  if (!owner_code_id || !name?.trim() || !quota) {
    return res.status(400).json({ error: 'Pelanggan, nama paket, dan kuota wajib diisi' });
  }

  const { data: active } = await supabase
    .from('customer_packages').select('id')
    .eq('owner_code_id', owner_code_id).eq('status', 'active').limit(1);
  if (active?.length) {
    return res.status(409).json({ error: 'Pelanggan ini masih punya paket aktif — pakai Perpanjang' });
  }

  const { data: last } = await supabase
    .from('customer_packages').select('period_no')
    .eq('owner_code_id', owner_code_id).order('period_no', { ascending: false }).limit(1);

  const { data, error } = await supabase
    .from('customer_packages')
    .insert({
      owner_code_id: parseInt(owner_code_id),
      name: name.trim(),
      quota: quotaOf(quota),
      price: Math.max(0, Number(price) || 0),
      period_no: (last?.[0]?.period_no || 0) + 1,
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  if (include_existing) {
    await supabase.from('wh_parcels')
      .update({ package_id: data.id })
      .eq('owner_code_id', owner_code_id)
      .is('package_id', null);
  }

  logActivity({
    action: 'package_add',
    summary: `Buat ${data.name} periode ${data.period_no} (kuota ${data.quota} resi)`,
    ref_type: 'package',
    ref_id: data.id,
  });
  res.json(data);
});

// ── Ubah nama / kuota ───────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const updates = {};
  if (req.body.name?.trim()) updates.name = req.body.name.trim();
  if (req.body.quota) updates.quota = quotaOf(req.body.quota);
  if (req.body.price !== undefined) updates.price = Math.max(0, Number(req.body.price) || 0);

  const { data, error } = await supabase
    .from('customer_packages').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Perpanjang: tutup periode ini, buka periode berikutnya ──────────
//  move_overflow: resi kelebihan dipindah ke periode baru
router.post('/:id/renew', async (req, res) => {
  const { name, quota, price, move_overflow = true } = req.body;

  const { data: old, error: oldErr } = await supabase
    .from('customer_packages').select('*').eq('id', req.params.id).single();
  if (oldErr || !old) return res.status(404).json({ error: 'Paket tidak ditemukan' });
  if (old.status !== 'active') return res.status(400).json({ error: 'Paket ini sudah ditutup' });

  const { data: fresh, error } = await supabase
    .from('customer_packages')
    .insert({
      owner_code_id: old.owner_code_id,
      name: name?.trim() || old.name,
      quota: quota ? quotaOf(quota) : old.quota,
      price: price !== undefined ? Math.max(0, Number(price) || 0) : old.price,
      period_no: old.period_no + 1,
    })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('customer_packages')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', old.id);

  // Resi ke-(quota+1) dst di periode lama → pindah ke periode baru
  let moved = 0;
  if (move_overflow) {
    const { data: rows } = await supabase
      .from('wh_parcels').select('id')
      .eq('package_id', old.id)
      .order('created_at', { ascending: true });
    const overflowIds = (rows || []).slice(old.quota).map(r => r.id);
    if (overflowIds.length) {
      // Kelebihan kini dibayar lewat paket baru → biaya satuannya dinolkan
      await supabase.from('wh_parcels').update({ package_id: fresh.id, wh_fee: 0 }).in('id', overflowIds);
      moved = overflowIds.length;
    }
  }

  logActivity({
    action: 'package_renew',
    summary: `Perpanjang ${old.name} → periode ${fresh.period_no} (kuota ${fresh.quota} resi)`,
    detail: moved ? `${moved} resi kelebihan dipindah ke periode baru` : null,
    ref_type: 'package',
    ref_id: fresh.id,
  });
  res.json({ closed: old, created: fresh, moved });
});

// ── Tutup paket tanpa perpanjang (pelanggan kembali satuan) ─────────
router.post('/:id/close', async (req, res) => {
  const { data, error } = await supabase
    .from('customer_packages')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: 'package_close',
    summary: `Tutup ${data.name} periode ${data.period_no}`,
    ref_type: 'package',
    ref_id: data.id,
  });
  res.json(data);
});

module.exports = router;
