const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Verify access code — returns which panels the code can access
router.post('/verify', async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Nama dan kode wajib diisi' });

  const { data, error } = await supabase
    .from('access_codes')
    .select('id, code, label, access_hc, access_wh')
    .eq('code', code.trim())
    .ilike('label', name.trim())
    .single();

  if (error || !data) return res.status(401).json({ error: 'Nama atau kode akses tidak valid' });

  res.json({
    valid: true,
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

  const { data, error } = await supabase
    .from('access_codes')
    .insert({
      code: code.trim(),
      label: label.trim(),
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
