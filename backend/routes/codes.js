const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Verify access code
router.post('/verify', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Kode tidak boleh kosong' });

  const { data, error } = await supabase
    .from('access_codes')
    .select('id, code, label')
    .eq('code', code.trim())
    .single();

  if (error || !data) return res.status(401).json({ error: 'Kode akses tidak valid' });

  res.json({ valid: true, label: data.label });
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
  const { code, label } = req.body;
  if (!code || !label) return res.status(400).json({ error: 'Kode dan label wajib diisi' });

  const { data, error } = await supabase
    .from('access_codes')
    .insert({ code: code.trim(), label: label.trim() })
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
