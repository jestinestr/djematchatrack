const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { logActivity, batchLabel } = require('../lib/log');

const money = (n, cur) => `${cur === 'CNY' ? '¥' : 'Rp'} ${Number(n || 0).toLocaleString('id-ID')}`;

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

// Update fee_per_gram (+ mata uangnya) for a batch
router.patch('/:id/fee', async (req, res) => {
  const { fee_per_gram, fee_currency, fine_amount, unboxing_fee } = req.body;
  if (fee_per_gram === undefined || isNaN(Number(fee_per_gram))) {
    return res.status(400).json({ error: 'fee_per_gram tidak valid' });
  }

  const updates = { fee_per_gram: Math.max(0, Number(fee_per_gram)) };
  if (fee_currency !== undefined) {
    updates.fee_currency = String(fee_currency).toUpperCase() === 'CNY' ? 'CNY' : 'IDR';
  }
  if (fine_amount !== undefined && !isNaN(Number(fine_amount))) {
    updates.fine_amount = Math.max(0, Number(fine_amount));
  }
  if (unboxing_fee !== undefined && !isNaN(Number(unboxing_fee))) {
    updates.unboxing_fee = Math.max(0, Number(unboxing_fee));
  }

  const { data, error } = await supabase
    .from('batches')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: 'batch_tarif',
    summary: `Ubah tarif ${batchLabel(data)} → ${money(data.fee_per_gram, data.fee_currency)}/gram`,
    detail: `Denda input manual: ${money(data.fine_amount, 'IDR')} per resi`,
    ref_type: 'batch',
    ref_id: data.id,
  });

  res.json(data);
});

// Toggle mode private — saat aktif, user hanya melihat resi miliknya
// secara utuh; resi orang lain disamarkan (4 digit terakhir + nama).
router.patch('/:id/private', async (req, res) => {
  const { is_private } = req.body;
  if (typeof is_private !== 'boolean') {
    return res.status(400).json({ error: 'is_private harus true/false' });
  }
  const { data, error } = await supabase
    .from('batches')
    .update({ is_private })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: 'batch_private',
    summary: `Mode private ${batchLabel(data)} ${is_private ? 'dinyalakan' : 'dimatikan'}`,
    ref_type: 'batch',
    ref_id: data.id,
  });

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

  logActivity({
    action: 'batch_complete',
    summary: `Selesaikan ${batchLabel(batch)} — dilanjut Batch ${batch.type} #${newBatch.batch_number}`,
    detail: 'Semua resi di batch tersebut dipindah ke arsip',
    ref_type: 'batch',
    ref_id: batch.id,
  });

  res.json({ completed: batch, new: newBatch });
});

module.exports = router;
