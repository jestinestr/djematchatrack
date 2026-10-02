const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { logActivity } = require('../lib/log');

// Penagihan yang sedang berlangsung.
//
// Satu baris lahir tiap kali invoice dicetak, lalu hidup sampai ditandai
// lunas. Gunanya supaya admin tidak perlu mengingat sendiri siapa yang
// sudah ditagih dan siapa yang belum bayar.
//
// Selama migrasi 017 belum dijalankan, semua route di sini menjawab dengan
// pesan yang menyebut file SQL-nya, dan halaman invoice tetap bisa dipakai.
const BELUM_AKTIF = 'Daftar penagihan belum aktif — jalankan supabase/migrations/017_billings.sql';

const PARCEL_TABLE = { HC: 'hc_parcels', WH: 'wh_parcels' };
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── Daftar penagihan ────────────────────────────────────────────────
//  ?status=unpaid|paid|all   (bawaan: unpaid — yang masih berjalan)
router.get('/', async (req, res) => {
  const status = String(req.query.status || 'unpaid');
  let query = supabase.from('billings').select('*').order('issued_at', { ascending: false }).limit(200);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return res.json({ billings: [], ready: false, error: BELUM_AKTIF });

  const codes = await supabase.from('access_codes').select('id, label, code');
  const byId = new Map((codes.data || []).map(c => [String(c.id), c]));

  res.json({
    ready: true,
    billings: (data || []).map(b => ({
      ...b,
      owner: byId.get(String(b.owner_code_id)) || null,
    })),
  });
});

// ── Catat invoice yang baru dicetak ─────────────────────────────────
//  Dicetak ulang untuk pelanggan & wadah yang sama tidak menumpuk baris
//  baru — barisnya diperbarui, karena yang berlaku memang cetakan terakhir.
router.post('/', async (req, res) => {
  const { scope, ref_id, type, owner_code_id, title, parcel_ids, total_idr, total_cny } = req.body;
  if (!['batch', 'box'].includes(scope) || !ref_id) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  const ids = Array.isArray(parcel_ids) ? parcel_ids : [];
  const payload = {
    scope,
    ref_id: parseInt(ref_id),
    type: String(type || 'WH').toUpperCase(),
    owner_code_id: owner_code_id ? parseInt(owner_code_id) : null,
    title: title || null,
    parcel_ids: ids,
    parcel_count: ids.length,
    total_idr: num(total_idr),
    total_cny: num(total_cny),
    status: 'unpaid',
    issued_at: new Date().toISOString(),
    paid_at: null,
  };

  try {
    let existing = null;
    if (payload.owner_code_id) {
      const { data } = await supabase.from('billings').select('id')
        .eq('scope', payload.scope).eq('ref_id', payload.ref_id)
        .eq('owner_code_id', payload.owner_code_id).eq('status', 'unpaid')
        .maybeSingle();
      existing = data;
    }

    const { data, error } = existing
      ? await supabase.from('billings').update(payload).eq('id', existing.id).select().single()
      : await supabase.from('billings').insert(payload).select().single();
    if (error) throw new Error(error.message);

    res.json(data);
  } catch {
    res.status(503).json({ error: BELUM_AKTIF });
  }
});

// ── Tandai lunas / batal lunas ──────────────────────────────────────
//  Sekalian menandai resi di dalam invoice itu, supaya tidak ikut lagi di
//  tagihan berikutnya — persis seperti menandai lunas satu per satu.
router.patch('/:id', async (req, res) => {
  const paid = req.body.status !== 'unpaid';

  const { data: bill, error: findErr } = await supabase
    .from('billings').select('*').eq('id', req.params.id).single();
  if (findErr || !bill) return res.status(404).json({ error: 'Penagihan tidak ditemukan' });

  const ids = Array.isArray(bill.parcel_ids) ? bill.parcel_ids : [];
  const table = PARCEL_TABLE[String(bill.type).toUpperCase()];
  if (ids.length && table) {
    await supabase.from(table)
      .update({ paid_at: paid ? new Date().toISOString() : null })
      .in('id', ids);
  }

  const { data, error } = await supabase
    .from('billings')
    .update({ status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: paid ? 'billing_paid' : 'billing_unpaid',
    summary: `${paid ? 'Lunas' : 'Batal lunas'}: ${bill.title || 'penagihan'}`,
    detail: `${ids.length} resi`,
    ref_type: 'billing',
    ref_id: bill.id,
  });

  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('billings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
