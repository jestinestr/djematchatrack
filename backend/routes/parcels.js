const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const supabase = require('../supabase');
const { fetchCodes, attachOwners, maskParcel, norm } = require('../lib/owner');
const { logActivity, batchLabel, parcelLabel } = require('../lib/log');
const { activePackageId, loadPackageInfo, attachPackage } = require('../lib/packages');

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
    .from('TrackFolder')
    .upload(filename, file.buffer, { contentType: file.mimetype });

  if (error) throw new Error('Upload foto gagal: ' + error.message);

  const { data } = supabase.storage.from('TrackFolder').getPublicUrl(filename);
  return data.publicUrl;
}

// Multi-field upload: 'photo' (arrival) + 'co_photo' (CO, admin-only)
const uploadFields = upload.fields([
  { name: 'photo',    maxCount: 1 },
  { name: 'co_photo', maxCount: 1 },
]);

const TABLE = { hc: 'hc_parcels', wh: 'wh_parcels' };
const BATCH_TYPE = { hc: 'HC', wh: 'WH' };

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const currencyOf = v => (String(v).toUpperCase() === 'CNY' ? 'CNY' : 'IDR');

// Besaran denda diambil dari setelan batch (halaman Control Tarif),
// bukan angka mati di kode.
async function getBatch(batchId) {
  if (!batchId) return null;
  const { data } = await supabase
    .from('batches').select('id, type, batch_number, fine_amount, unboxing_fee').eq('id', batchId).single();
  return data || null;
}


// Field yang dikirim dari form admin -> kolom tabel
//
// Catatan: menandai resi sebagai "input manual" TIDAK lagi otomatis
// menambah denda. Tanda itu murni penanda; besaran denda diisi admin
// sendiri di kolom Denda (tombol isi cepat memakai setelan batch).
function buildPayload(kind, body, batch = null) {
  const isManual = body.is_manual_input === 'true' || body.is_manual_input === true;
  const payload = {
    tracking_number: body.tracking_number?.trim(),
    recipient_name: body.recipient_name?.trim(),
    type: body.type,
    currency: currencyOf(body.currency),
    additional_fee: Math.max(0, num(body.additional_fee)),
    owner_code_id: body.owner_code_id ? parseInt(body.owner_code_id) : null,
    is_manual_input: isManual,
    fine_amount: Math.max(0, num(body.fine_amount)), // selalu dalam Rupiah
  };
  if (kind === 'hc') {
    payload.estimated_weight_grams = parseInt(body.estimated_weight_grams) || 0;
    payload.estimated_quantity = parseInt(body.estimated_quantity) || 1;
    payload.hc_fee = Math.max(0, num(body.hc_fee));
  } else {
    payload.wh_fee = Math.max(0, num(body.wh_fee));
    payload.estimated_weight_grams = parseInt(body.estimated_weight_grams) || 0;
    // Video unboxing: biaya (Yuan) diambil dari tarif batch di Control Tarif
    const needUnboxing = body.need_unboxing === 'true' || body.need_unboxing === true;
    payload.need_unboxing = needUnboxing;
    payload.unboxing_fee = needUnboxing ? Math.max(0, num(batch?.unboxing_fee, 0.75)) : 0;
  }
  return payload;
}

const sortNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// Batch diurutkan: aktif dulu, lalu batch selesai dari yang terbaru
const sortBatches = (a, b) => {
  if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
  return (b.batch_number || 0) - (a.batch_number || 0);
};

async function loadBatches(kind, { onlyActive = false } = {}) {
  const table = TABLE[kind];
  let query = supabase
    .from('batches')
    .select(`*, ${table}(*)`)
    .eq('type', BATCH_TYPE[kind]);
  if (onlyActive) query = query.eq('status', 'active');

  const { data, error } = await query.order('batch_number', { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).map(b => {
    const { [table]: rows, ...batch } = b;
    return { ...batch, parcels: (rows || []).slice().sort(sortNewest) };
  });
}

// ── Admin: semua batch + resi, lengkap dengan info pemilik ──────────
function registerAdminList(kind) {
  router.get(`/${kind}/all`, async (req, res) => {
    try {
      const [batches, codes, pkgInfo] = await Promise.all([
        loadBatches(kind),
        fetchCodes(),
        kind === 'wh' ? loadPackageInfo() : null,
      ]);
      res.json(batches.map(b => {
        let parcels = attachOwners(b.parcels, codes);
        if (pkgInfo) parcels = attachPackage(parcels, pkgInfo.parcelInfo);
        return { ...b, parcels };
      }));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

// ── User: tampilan berbasis kepemilikan ─────────────────────────────
//  Kode akses dikirim lewat header X-Access-Code (bukan query string).
//
//  Batch aktif  : semua resi tampil; kalau batch private, resi orang
//                 lain disamarkan (4 digit terakhir + nama, foto disensor).
//  Batch selesai: hanya resi milik sendiri, dan hanya batch yang memang
//                 berisi resi miliknya.
function registerUserView(kind) {
  router.get(`/${kind}/view`, async (req, res) => {
    const rawCode = (req.get('X-Access-Code') || '').trim();
    if (!rawCode) return res.status(401).json({ error: 'Kode akses tidak dikirim' });

    try {
      const codes = await fetchCodes();
      const me = codes.find(c => norm(c.code) === norm(rawCode));
      if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

      const allowed = kind === 'hc' ? (me.access_hc ?? true) : (me.access_wh ?? true);
      if (!allowed) {
        return res.status(403).json({ error: `Kode ini tidak memiliki akses ke ${BATCH_TYPE[kind]}` });
      }

      const [batches, pkgInfo] = await Promise.all([
        loadBatches(kind),
        kind === 'wh' ? loadPackageInfo() : null,
      ]);
      const result = [];

      for (const batch of batches) {
        // Ketat: hanya resi yang pemiliknya di-assign eksplisit yang diakui
        // milik seseorang — tebakan dari nama tidak dipakai di sisi user.
        let withOwners = attachOwners(batch.parcels, codes, { allowNameMatch: false });
        if (pkgInfo) withOwners = attachPackage(withOwners, pkgInfo.parcelInfo);
        const mine = withOwners.filter(p => p.owner && String(p.owner.id) === String(me.id));
        const isActive = batch.status === 'active';

        if (!isActive && mine.length === 0) continue; // batch lama tanpa resi dia

        let parcels;
        if (!isActive) {
          parcels = mine.map(p => ({ ...p, is_mine: true }));
        } else if (batch.is_private) {
          parcels = withOwners.map(p =>
            p.owner && String(p.owner.id) === String(me.id)
              ? { ...p, is_mine: true }
              : maskParcel(p)
          );
        } else {
          parcels = withOwners.map(p => ({
            ...p,
            is_mine: !!(p.owner && String(p.owner.id) === String(me.id)),
          }));
        }

        result.push({
          ...batch,
          parcels,
          mine_count: mine.length,
          total_count: withOwners.length,
        });
      }

      res.json({
        viewer: { id: me.id, label: me.label },
        // Paket aktif pelanggan ini (WH), untuk kartu kuota di panelnya
        package: pkgInfo?.packages.find(p =>
          String(p.owner_code_id) === String(me.id) && p.status === 'active') || null,
        batches: result.sort(sortBatches),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

// ── CRUD ────────────────────────────────────────────────────────────
function registerCrud(kind) {
  const table = TABLE[kind];

  router.post(`/${kind}`, uploadFields, async (req, res) => {
    const { batch_id, tracking_number, recipient_name, type } = req.body;
    if (!batch_id || !tracking_number || !recipient_name || !type) {
      return res.status(400).json({ error: 'Field wajib tidak lengkap' });
    }

    try {
      const batch = await getBatch(parseInt(batch_id));
      const payload = buildPayload(kind, req.body, batch);
      payload.batch_id = parseInt(batch_id);
      if (kind === 'wh' && payload.owner_code_id) {
        const pkgId = await activePackageId(payload.owner_code_id);
        if (pkgId) payload.package_id = pkgId; // resi otomatis masuk paket aktif
      }
      payload.photo_url = await uploadPhoto(req.files?.['photo']?.[0]);
      if (payload.photo_url) payload.photo_uploaded_at = new Date().toISOString();
      payload.co_photo_url = await uploadPhoto(req.files?.['co_photo']?.[0]);

      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) return res.status(500).json({ error: error.message });

      const codes = await fetchCodes();
      const saved = attachOwners([data], codes)[0];

      logActivity({
        action: 'parcel_add',
        summary: `Tambah resi ${parcelLabel(saved, saved.owner?.label)} di ${batchLabel(batch)}`,
        ref_type: `${kind}_parcel`,
        ref_id: saved.id,
      });

      res.json(saved);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.patch(`/${kind}/:id`, uploadFields, async (req, res) => {
    try {
      // Denda mengikuti batch tempat resi ini berada
      const { data: current } = await supabase
        .from(table).select('batch_id, owner_code_id, tracking_number').eq('id', req.params.id).single();
      const batch = await getBatch(current?.batch_id);
      const updates = buildPayload(kind, req.body, batch);
      // Ganti pemilik → resi ikut paket aktif pemilik baru
      if (kind === 'wh' && String(current?.owner_code_id ?? '') !== String(updates.owner_code_id ?? '')) {
        const pkgId = await activePackageId(updates.owner_code_id);
        if (pkgId !== undefined) updates.package_id = pkgId;
      }
      const photoFile = req.files?.['photo']?.[0];
      const coPhotoFile = req.files?.['co_photo']?.[0];
      if (photoFile) {
        updates.photo_url = await uploadPhoto(photoFile);
        updates.photo_uploaded_at = new Date().toISOString(); // hitungan hari simpan mulai ulang
      }
      if (coPhotoFile) updates.co_photo_url = await uploadPhoto(coPhotoFile);

      const { data, error } = await supabase
        .from(table).update(updates).eq('id', req.params.id).select().single();
      if (error) return res.status(500).json({ error: error.message });

      const codes = await fetchCodes();
      const saved = attachOwners([data], codes)[0];

      // Perpindahan pemilik dicatat terpisah — ini yang paling sering
      // perlu diingat lagi belakangan.
      const ownerBefore = codes.find(c => String(c.id) === String(current?.owner_code_id));
      const ownerChanged = String(current?.owner_code_id ?? '') !== String(saved.owner_code_id ?? '');

      logActivity({
        action: ownerChanged ? 'parcel_owner' : 'parcel_edit',
        summary: ownerChanged
          ? `Resi ${saved.tracking_number} jadi milik ${saved.owner?.label || 'tanpa pemilik'} di ${batchLabel(batch)}`
          : `Edit resi ${parcelLabel(saved, saved.owner?.label)} di ${batchLabel(batch)}`,
        detail: ownerChanged
          ? `Sebelumnya: ${ownerBefore?.label || 'tanpa pemilik'}`
          : null,
        ref_type: `${kind}_parcel`,
        ref_id: saved.id,
      });

      res.json(saved);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete(`/${kind}/:id`, async (req, res) => {
    const { data: before } = await supabase
      .from(table).select('tracking_number, recipient_name').eq('id', req.params.id).single();

    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });

    logActivity({
      action: 'parcel_delete',
      summary: `Hapus resi ${parcelLabel(before, before?.recipient_name)}`,
      ref_type: `${kind}_parcel`,
      ref_id: req.params.id,
    });

    res.json({ success: true });
  });
}

for (const kind of ['hc', 'wh']) {
  registerAdminList(kind);
  registerUserView(kind);
  registerCrud(kind);
}

module.exports = router;
