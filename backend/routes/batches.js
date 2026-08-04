const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Get active batch for type
router.get('/active/:type', async (req, res) => {
  const type = req.params.type.toUpperCase();
  if (!['HC', 'WH'].includes(type)) return res.status(400).json({ error: 'Tipe tidak valid' });

  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('type', type)
    .eq('status', 'active')
    .single();

  if (error) return res.status(404).json({ error: 'Tidak ada batch aktif' });
  res.json(data);
});

// Get all batches for type (admin, includes archived)
router.get('/all/:type', async (req, res) => {
  const type = req.params.type.toUpperCase();

  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('type', type)
    .order('batch_number', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update fee_per_gram for a batch
router.patch('/:id/fee', async (req, res) => {
  const { fee_per_gram } = req.body;
  if (fee_per_gram === undefined || isNaN(Number(fee_per_gram))) {
    return res.status(400).json({ error: 'fee_per_gram tidak valid' });
  }
  const { data, error } = await supabase
    .from('batches')
    .update({ fee_per_gram: Math.max(0, Math.round(Number(fee_per_gram))) })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Complete batch and start new one
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;

  // Get current batch
  const { data: batch, error: fetchErr } = await supabase
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !batch) return res.status(404).json({ error: 'Batch tidak ditemukan' });
  if (batch.status === 'completed') return res.status(400).json({ error: 'Batch sudah selesai' });

  // 1. Mark batch as completed
  const { error: batchErr } = await supabase
    .from('batches')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id);

  if (batchErr) return res.status(500).json({ error: batchErr.message });

  // 2. Archive all parcels in this batch
  const table = batch.type === 'HC' ? 'hc_parcels' : 'wh_parcels';
  const { error: parcelErr } = await supabase
    .from(table)
    .update({ status: 'archived' })
    .eq('batch_id', id);

  if (parcelErr) return res.status(500).json({ error: parcelErr.message });

  // 3. Create new active batch
  const { data: newBatch, error: newBatchErr } = await supabase
    .from('batches')
    .insert({ type: batch.type, batch_number: batch.batch_number + 1, status: 'active' })
    .select()
    .single();

  if (newBatchErr) return res.status(500).json({ error: newBatchErr.message });

  res.json({ completed: batch, new: newBatch });
});

module.exports = router;
