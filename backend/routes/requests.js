const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ── GET all requests (admin) ─────────────────────────────
// ?status=pending|approved|rejected|all
router.get('/', async (req, res) => {
  const { status = 'pending' } = req.query;

  let query = supabase
    .from('parcel_requests')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET pending count (for badge) ───────────────────────
router.get('/count', async (req, res) => {
  const { count, error } = await supabase
    .from('parcel_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ count });
});

// ── POST submit requests (user) — max 10 ────────────────
router.post('/', async (req, res) => {
  const { type, items } = req.body; // type: 'HC'|'WH', items: array

  if (!type || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }
  if (items.length > 10) {
    return res.status(400).json({ error: 'Maksimal 10 resi per request' });
  }

  const rows = items.map(item => ({
    type,
    tracking_number: item.tracking_number?.trim(),
    recipient_name: item.recipient_name?.trim(),
    parcel_type: item.parcel_type || 'barang',
    notes: item.notes?.trim() || null,
    status: 'pending',
  }));

  // Validate all rows
  for (const r of rows) {
    if (!r.tracking_number || !r.recipient_name) {
      return res.status(400).json({ error: 'Nomor resi dan nama penerima wajib diisi' });
    }
  }

  const { data, error } = await supabase
    .from('parcel_requests')
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PATCH approve ────────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
  // 1. Get the request
  const { data: req_data, error: fetchErr } = await supabase
    .from('parcel_requests')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !req_data) return res.status(404).json({ error: 'Request tidak ditemukan' });
  if (req_data.status !== 'pending') return res.status(400).json({ error: 'Request sudah diproses' });

  const parcelType = req_data.type; // 'HC' or 'WH'
  const table = parcelType === 'HC' ? 'hc_parcels' : 'wh_parcels';

  // 2. Find active batch of this type
  const { data: batch, error: batchErr } = await supabase
    .from('batches')
    .select('id')
    .eq('type', parcelType)
    .eq('status', 'active')
    .order('batch_number', { ascending: false })
    .limit(1)
    .single();

  if (batchErr || !batch) return res.status(400).json({ error: `Tidak ada batch ${parcelType} aktif` });

  // 3. Insert into parcel table
  const insertData = {
    batch_id: batch.id,
    tracking_number: req_data.tracking_number,
    recipient_name: req_data.recipient_name,
    type: req_data.parcel_type,
    status: 'active',
    is_manual_input: false,
    fine_amount: 0,
  };
  if (parcelType === 'HC') {
    insertData.estimated_weight_grams = 0;
    insertData.estimated_quantity = 1;
  } else {
    insertData.wh_fee = 0;
  }

  const { error: insertErr } = await supabase.from(table).insert(insertData);
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // 4. Mark as approved
  const { data: updated, error: updateErr } = await supabase
    .from('parcel_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json(updated);
});

// ── PATCH reject ─────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const { data, error } = await supabase
    .from('parcel_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE request ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('parcel_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
