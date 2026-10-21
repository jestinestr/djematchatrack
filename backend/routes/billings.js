const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { logActivity } = require('../lib/log');
const { hasColumn } = require('../lib/columns');
const { closeBoxAfterPaid } = require('../lib/box');

// Penagihan yang sedang berlangsung.
//
// Satu baris lahir tiap kali invoice dicetak, lalu hidup sampai ditandai
// lunas. Gunanya supaya admin tidak perlu mengingat sendiri siapa yang
// sudah ditagih dan siapa yang belum bayar.
//
// Selama migrasi 017 belum dijalankan, semua route di sini menjawab dengan
// pesan yang menyebut file SQL-nya, dan halaman invoice tetap bisa dipakai.
const BAYAR_BELUM_AKTIF = 'Pembayaran invoice belum aktif — jalankan supabase/migrations/018_billing_payments.sql';
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

  const [codes, pays] = await Promise.all([
    supabase.from('access_codes').select('id, label, code'),
    supabase.from('billing_payments').select('billing_id, amount, currency'),
  ]);
  const byId = new Map((codes.data || []).map(c => [String(c.id), c]));

  res.json({
    ready: true,
    billings: (data || []).map(b => ({
      ...b,
      owner: byId.get(String(b.owner_code_id)) || null,
      ...paymentSummary(b, pays.data || []),
    })),
  });
});

// Berapa yang sudah dibayar dan berapa sisanya, per mata uang.
//  due  > 0 → masih kurang bayar
//  due  < 0 → pelanggan kelebihan bayar, jadi titipan untuk invoice berikut
//
// Kalau invoicenya menyimpan kurs, kelebihan bayar di satu mata uang
// dipakai menutup kekurangan di mata uang satunya. Itu yang membuat
// tagihan Yuan bisa dilunasi dengan Rupiah: kursnya ikut kurs invoice
// waktu dicetak, bukan kurs hari ini.
function paymentSummary(bill, payments) {
  const mine = payments.filter(p => String(p.billing_id) === String(bill.id));
  const paid_idr = mine.filter(p => p.currency === 'IDR').reduce((s, p) => s + num(p.amount), 0);
  const paid_cny = mine.filter(p => p.currency !== 'IDR').reduce((s, p) => s + num(p.amount), 0);

  const rate = num(bill.cny_rate);
  let due_idr = num(bill.total_idr) - paid_idr;
  let due_cny = num(bill.total_cny) - paid_cny;

  if (rate > 0) {
    if (due_idr < -0.009 && due_cny > 0.009) {
      const pakai = Math.min(-due_idr / rate, due_cny);   // Rupiah menutup Yuan
      due_cny -= pakai;
      due_idr += pakai * rate;
    } else if (due_cny < -0.009 && due_idr > 0.009) {
      const pakai = Math.min(-due_cny * rate, due_idr);   // Yuan menutup Rupiah
      due_idr -= pakai;
      due_cny += pakai / rate;
    }
  }

  const bersih = v => (Math.abs(v) < 0.009 ? 0 : v);
  return {
    paid_idr,
    paid_cny,
    rate,
    due_idr: bersih(due_idr),
    due_cny: bersih(due_cny),
    // Sisa tagihan kalau semuanya dihitung dalam Rupiah — dipakai panel
    // pembayaran supaya admin tahu persis berapa yang harus ditransfer.
    due_equiv_idr: rate > 0 ? bersih(due_idr + due_cny * rate) : null,
    payment_count: mine.length,
  };
}

// ── Pembayaran atas satu penagihan ──────────────────────────────────
router.get('/:id/payments', async (req, res) => {
  const { data, error } = await supabase
    .from('billing_payments').select('*')
    .eq('billing_id', req.params.id)
    .order('paid_at', { ascending: true });
  if (error) return res.status(503).json({ error: BAYAR_BELUM_AKTIF });
  res.json(data || []);
});

router.post('/:id/payments', async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Nominal pembayaran tidak valid' });
  }

  const { data, error } = await supabase.from('billing_payments').insert({
    billing_id: parseInt(req.params.id),
    amount,
    currency: String(req.body.currency).toUpperCase() === 'IDR' ? 'IDR' : 'CNY',
    note: req.body.note?.trim() || null,
  }).select().single();
  if (error) return res.status(503).json({ error: BAYAR_BELUM_AKTIF });

  const { data: bill } = await supabase.from('billings').select('title').eq('id', req.params.id).single();
  logActivity({
    action: 'billing_payment',
    summary: `Pembayaran ${data.currency} ${Math.round(amount).toLocaleString('id-ID')} untuk ${bill?.title || 'penagihan'}`,
    detail: data.note || null,
    ref_type: 'billing',
    ref_id: req.params.id,
  });

  res.json(data);
});

router.delete('/payments/:paymentId', async (req, res) => {
  const { error } = await supabase.from('billing_payments').delete().eq('id', req.params.paymentId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Sisa tagihan pelanggan yang belum tutup buku ────────────────────
//  Dipakai invoice berikutnya: yang kurang bayar ikut ditagih lagi, yang
//  kelebihan bayar jadi potongan. Hanya penagihan yang belum ditandai
//  lunas yang dihitung — menandai lunas berarti admin menganggap selesai.
router.get('/outstanding/:ownerId', async (req, res) => {
  let query = supabase
    .from('billings').select('*')
    .eq('owner_code_id', req.params.ownerId).eq('status', 'unpaid');
  // Yang saldonya sudah digulung ke invoice berikutnya tidak dihitung lagi
  if (await hasColumn('billings', 'rolled_into')) query = query.is('rolled_into', null);

  const { data, error } = await query;
  if (error) return res.json({ idr: 0, cny: 0, items: [] });

  const ids = (data || []).map(b => b.id);
  const pays = ids.length
    ? (await supabase.from('billing_payments').select('billing_id, amount, currency').in('billing_id', ids)).data || []
    : [];

  const items = (data || []).map(b => ({ ...b, ...paymentSummary(b, pays) }));
  res.json({
    idr: items.reduce((s, b) => s + b.due_idr, 0),
    cny: items.reduce((s, b) => s + b.due_cny, 0),
    items,
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

  // Kurs invoice disimpan kalau kolomnya sudah ada (migrasi 021)
  if (await hasColumn('billings', 'cny_rate')) {
    payload.cny_rate = Math.max(0, num(req.body.cny_rate));
  }

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

    // Kurang/lebih bayar yang ikut dihitung di invoice ini berarti sudah
    // pindah ke sini — penagihan lamanya ditandai supaya saldonya tidak
    // terbawa lagi ke invoice berikutnya.
    const rolled = Array.isArray(req.body.rolled_from) ? req.body.rolled_from : [];
    const lain = rolled.filter(id => String(id) !== String(data.id));
    if (lain.length && await hasColumn('billings', 'rolled_into')) {
      await supabase.from('billings').update({ rolled_into: data.id }).in('id', lain);
    }

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

  // Invoice box lunas boleh sekalian menutup boxnya; resi yang belum
  // ditagih pindah ke box baru supaya pelanggan tidak nyangkut di box lama.
  // Penutupan itu tidak selalu diinginkan — mis. tagihan sebagian yang
  // resinya masih menunggu invoice berikutnya — jadi penanya ada di layar
  // dan jawabannya dikirim lewat close_box.
  const tutupBox = req.body.close_box === undefined ? true : !!req.body.close_box;
  let boxResult = { closed: false, moved: 0 };
  if (paid && tutupBox && bill.scope === 'box' && String(bill.type).toUpperCase() === 'WH') {
    boxResult = await closeBoxAfterPaid(bill.ref_id, ids);
  }

  logActivity({
    action: paid ? 'billing_paid' : 'billing_unpaid',
    summary: `${paid ? 'Lunas' : 'Batal lunas'}: ${bill.title || 'penagihan'}`,
    detail: `${ids.length} resi${boxResult.closed ? ` · box otomatis ditutup${boxResult.moved ? `, ${boxResult.moved} resi belum ditagih pindah ke ${boxResult.newBoxName}` : ''}` : ''}`,
    ref_type: 'billing',
    ref_id: bill.id,
  });

  res.json({ ...data, box_closed: boxResult.closed, box_moved: boxResult.moved });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('billings').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
