const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { logActivity } = require('../lib/log');

// ── Daftar catatan, terbaru dulu ────────────────────────────────────
//  ?limit=200  ?q=kata kunci  ?action=note
router.get('/', async (req, res) => {
  const { limit = 300, q, action } = req.query;

  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(parseInt(limit) || 300, 1000));

  if (action && action !== 'all') query = query.eq('action', action);
  if (q?.trim()) query = query.ilike('summary', `%${q.trim()}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Catatan manual yang diketik admin sendiri ───────────────────────
router.post('/', async (req, res) => {
  const { summary } = req.body;
  if (!summary?.trim()) return res.status(400).json({ error: 'Catatan tidak boleh kosong' });

  const { data, error } = await supabase
    .from('activity_logs')
    .insert({ action: 'note', summary: summary.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Hapus satu baris catatan ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('activity_logs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
