const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Verify access code — returns which panels the code can access
router.post('/verify', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Kode tidak boleh kosong' });

  const { data, error } = await supabase
    .from('access_codes')
    .select('id, code, label, access_hc, access_wh')
    .eq('code', code.trim())
    .single();

  if (error || !data) return res.status(401).json({ error: 'Kode akses tidak valid' });

  res.json({
    valid: true,
    id: data.id,
    code: data.code,
    label: data.label,
    access_hc: data.access_hc ?? true,
    access_wh: data.access_wh ?? true,
  });
});

// List all codes (admin)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('access_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create code (admin)
router.post('/', async (req, res) => {
  const { code, label, access_hc, access_wh } = req.body;
  if (!code || !label) return res.status(400).json({ error: 'Kode dan label wajib diisi' });

  const trimmedCode = code.trim();
  const trimmedLabel = label.trim();

  // Cek nama & kode belum dipakai (case-insensitive)
  const { data: existing } = await supabase
    .from('access_codes')
    .select('code, label')
    .or(`code.ilike.${trimmedCode},label.ilike.${trimmedLabel}`);

  if (existing?.some(e => e.label.toLowerCase() === trimmedLabel.toLowerCase()))
    return res.status(409).json({ error: 'Nama sudah dipakai' });
  if (existing?.some(e => e.code.toLowerCase() === trimmedCode.toLowerCase()))
    return res.status(409).json({ error: 'Kode akses sudah dipakai' });

  const { data, error } = await supabase
    .from('access_codes')
    .insert({
      code: trimmedCode,
      label: trimmedLabel,
      access_hc: access_hc !== false,
      access_wh: access_wh !== false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Kode sudah ada' });
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// Edit code (admin) — ubah nama, kode, atau hak akses panel
//
// Mematikan akses HC/WH TIDAK menghapus resi milik pelanggan ini. Resi yang
// sudah ada di batch aktif maupun batch lama tetap tersimpan sebagai rekam
// jejak; pelanggan hanya tidak bisa lagi membuka panel tersebut.
router.patch('/:id', async (req, res) => {
  const { code, label, access_hc, access_wh } = req.body;
  const updates = {};

  if (label !== undefined) {
    const trimmed = String(label).trim();
    if (!trimmed) return res.status(400).json({ error: 'Nama tidak boleh kosong' });
    updates.label = trimmed;
  }
  if (code !== undefined) {
    const trimmed = String(code).trim();
    if (!trimmed) return res.status(400).json({ error: 'Kode tidak boleh kosong' });
    updates.code = trimmed;
  }
  if (access_hc !== undefined) updates.access_hc = !!access_hc;
  if (access_wh !== undefined) updates.access_wh = !!access_wh;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Tidak ada perubahan' });
  }

  // Minimal satu panel harus tetap bisa diakses
  const { data: current, error: currentErr } = await supabase
    .from('access_codes').select('*').eq('id', req.params.id).single();
  if (currentErr || !current) return res.status(404).json({ error: 'Kode akses tidak ditemukan' });

  const nextHc = updates.access_hc ?? current.access_hc ?? true;
  const nextWh = updates.access_wh ?? current.access_wh ?? true;
  if (!nextHc && !nextWh) {
    return res.status(400).json({ error: 'Minimal satu akses panel harus aktif' });
  }

  // Nama & kode tetap harus unik (kecuali terhadap dirinya sendiri)
  if (updates.label || updates.code) {
    const { data: others } = await supabase
      .from('access_codes').select('id, code, label').neq('id', req.params.id);

    const clash = (others || []).find(o =>
      (updates.label && o.label.toLowerCase() === updates.label.toLowerCase()) ||
      (updates.code && o.code.toLowerCase() === updates.code.toLowerCase())
    );
    if (clash) {
      const sameLabel = updates.label && clash.label.toLowerCase() === updates.label.toLowerCase();
      return res.status(409).json({ error: sameLabel ? 'Nama sudah dipakai' : 'Kode akses sudah dipakai' });
    }
  }

  const { data, error } = await supabase
    .from('access_codes').update(updates).eq('id', req.params.id).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete code (admin)
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('access_codes')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
