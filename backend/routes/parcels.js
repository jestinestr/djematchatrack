const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase');

// Use memory storage — file goes to Supabase Storage, not disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB (Vercel free tier limit)
});

// Upload photo to Supabase Storage, return public URL
async function uploadPhoto(file) {
  if (!file) return null;
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const { error } = await supabase.storage
    .from('parcel-photos')
    .upload(filename, file.buffer, { contentType: file.mimetype });

  if (error) throw new Error('Upload foto gagal: ' + error.message);

  const { data } = supabase.storage.from('parcel-photos').getPublicUrl(filename);
  return data.publicUrl;
}

// ── HC ─────────────────────────────────────────────────────────────────

// Get active HC parcels grouped by batch (user view)
router.get('/hc/active', async (req, res) => {
  const { data: batches, error } = await supabase
    .from('batches')
    .select('*, hc_parcels(*)')
    .eq('type', 'HC')
    .eq('status', 'active')
    .order('batch_number', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Only include active parcels, sorted newest first
  const result = batches.map(b => ({
    ...b,
    parcels: (b.hc_parcels || [])
      .filter(p => p.status === 'active')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    hc_parcels: undefined,
  }));

  res.json(result);
});

// Get all HC parcels grouped by batch (admin view — all statuses)
router.get('/hc/all', async (req, res) => {
  const { data: batches, error } = await supabase
    .from('batches')
    .select('*, hc_parcels(*)')
    .eq('type', 'HC')
    .order('batch_number', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = batches.map(b => ({
    ...b,
    parcels: (b.hc_parcels || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    hc_parcels: undefined,
  }));

  res.json(result);
});

// Add HC parcel
router.post('/hc', upload.single('photo'), async (req, res) => {
  const { batch_id, tracking_number, recipient_name, type, estimated_weight_grams, estimated_quantity, is_manual_input } = req.body;

  if (!batch_id || !tracking_number || !recipient_name || !type) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }

  const isManual = is_manual_input === 'true';
  const fine = isManual ? 2000 : 0;

  try {
    const photoUrl = await uploadPhoto(req.file);

    const { data, error } = await supabase
      .from('hc_parcels')
      .insert({
        batch_id: parseInt(batch_id),
        tracking_number: tracking_number.trim(),
        recipient_name: recipient_name.trim(),
        photo_url: photoUrl,
        type,
        estimated_weight_grams: parseInt(estimated_weight_grams) || 0,
        estimated_quantity: parseInt(estimated_quantity) || 1,
        is_manual_input: isManual,
        fine_amount: fine,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete HC parcel
router.delete('/hc/:id', async (req, res) => {
  const { error } = await supabase.from('hc_parcels').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── WH ─────────────────────────────────────────────────────────────────

// Get active WH parcels grouped by batch (user view)
router.get('/wh/active', async (req, res) => {
  const { data: batches, error } = await supabase
    .from('batches')
    .select('*, wh_parcels(*)')
    .eq('type', 'WH')
    .eq('status', 'active')
    .order('batch_number', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = batches.map(b => ({
    ...b,
    parcels: (b.wh_parcels || [])
      .filter(p => p.status === 'active')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    wh_parcels: undefined,
  }));

  res.json(result);
});

// Get all WH parcels grouped by batch (admin view)
router.get('/wh/all', async (req, res) => {
  const { data: batches, error } = await supabase
    .from('batches')
    .select('*, wh_parcels(*)')
    .eq('type', 'WH')
    .order('batch_number', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const result = batches.map(b => ({
    ...b,
    parcels: (b.wh_parcels || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    wh_parcels: undefined,
  }));

  res.json(result);
});

// Add WH parcel
router.post('/wh', upload.single('photo'), async (req, res) => {
  const { batch_id, tracking_number, recipient_name, type, wh_fee, is_manual_input } = req.body;

  if (!batch_id || !tracking_number || !recipient_name || !type) {
    return res.status(400).json({ error: 'Field wajib tidak lengkap' });
  }

  const isManual = is_manual_input === 'true';
  const fine = isManual ? 2000 : 0;

  try {
    const photoUrl = await uploadPhoto(req.file);

    const { data, error } = await supabase
      .from('wh_parcels')
      .insert({
        batch_id: parseInt(batch_id),
        tracking_number: tracking_number.trim(),
        recipient_name: recipient_name.trim(),
        photo_url: photoUrl,
        type,
        wh_fee: parseInt(wh_fee) || 0,
        is_manual_input: isManual,
        fine_amount: fine,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete WH parcel
router.delete('/wh/:id', async (req, res) => {
  const { error } = await supabase.from('wh_parcels').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
