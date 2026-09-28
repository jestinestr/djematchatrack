const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes, attachOwners } = require('../lib/owner');
const { logActivity } = require('../lib/log');

const TABLE = { HC: 'hc_parcels', WH: 'wh_parcels' };
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const currencyOf = v => (String(v).toUpperCase() === 'CNY' ? 'CNY' : 'IDR');

const emptyTotals = () => ({
  IDR: { fee: 0, additional: 0, fine: 0, unboxing: 0, total: 0 },
  CNY: { fee: 0, additional: 0, fine: 0, unboxing: 0, total: 0 },
});

// Fee pokok sebuah resi sesuai tipe batch
function baseFee(parcel, type) {
  return type === 'HC' ? num(parcel.hc_fee) : num(parcel.wh_fee);
}

function addParcel(totals, parcel, type) {
  const cur = currencyOf(parcel.currency);
  totals[cur].fee += baseFee(parcel, type);
  totals[cur].additional += num(parcel.additional_fee);
  // Denda selalu Rupiah, apa pun mata uang resinya
  totals.IDR.fine += num(parcel.fine_amount);
  // Video unboxing (WH) selalu dalam Yuan
  totals.CNY.unboxing += num(parcel.unboxing_fee);
}

function finalize(totals) {
  for (const cur of ['IDR', 'CNY']) {
    const t = totals[cur];
    t.total = t.fee + t.additional + t.fine + t.unboxing;
  }
  return totals;
}

// ── Rekap invoice satu batch, dikelompokkan per pelanggan ───────────
router.get('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const { data: batch, error: batchErr } = await supabase
      .from('batches').select('*').eq('id', batchId).single();
    if (batchErr || !batch) return res.status(404).json({ error: 'Batch tidak ditemukan' });

    const table = TABLE[batch.type];
    const [{ data: rows, error: parcelErr }, codes, { data: saved }] = await Promise.all([
      supabase.from(table).select('*').eq('batch_id', batchId),
      fetchCodes(),
      supabase.from('batch_invoices').select('*').eq('batch_id', batchId),
    ]);
    if (parcelErr) return res.status(500).json({ error: parcelErr.message });

    const parcels = attachOwners(rows || [], codes);
    const savedByOwner = new Map((saved || []).map(s => [String(s.owner_code_id), s]));

    // Biaya tambahan boleh lebih dari satu baris (tabel invoice_fees).
    // Kolom lama batch_invoices.additional_fee tetap dihitung supaya invoice
    // yang sudah terlanjur diisi sebelum migrasi 014 tidak berubah angkanya.
    const feeRows = await supabase.from('invoice_fees').select('*').eq('batch_id', batch.id);
    const feesByOwner = new Map();
    for (const row of feeRows.data || []) {
      const key = String(row.owner_code_id);
      if (!feesByOwner.has(key)) feesByOwner.set(key, []);
      feesByOwner.get(key).push(row);
    }

    // Kelompokkan per pemilik; resi tanpa pemilik masuk grup khusus
    const groups = new Map();
    for (const p of parcels) {
      const key = p.owner ? String(p.owner.id) : '__unassigned__';
      if (!groups.has(key)) {
        groups.set(key, { owner: p.owner || null, parcels: [], totals: emptyTotals() });
      }
      const g = groups.get(key);
      g.parcels.push(p);
      addParcel(g.totals, p, batch.type);
    }

    const customers = [...groups.values()].map(g => {
      const invoice = g.owner ? savedByOwner.get(String(g.owner.id)) || null : null;
      const fees = (g.owner ? feesByOwner.get(String(g.owner.id)) : null) || [];

      if (invoice) {
        // Additional fee manual dari invoice ikut masuk total
        const cur = currencyOf(invoice.additional_fee_currency);
        g.totals[cur].additional += num(invoice.additional_fee);
      }
      for (const fee of fees) {
        g.totals[currencyOf(fee.currency)].additional += num(fee.amount);
      }

      return {
        owner: g.owner,
        parcels: g.parcels.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        parcel_count: g.parcels.length,
        totals: finalize(g.totals),
        fees: fees
          .map(f => ({ id: f.id, label: f.label || '', amount: num(f.amount), currency: currencyOf(f.currency) }))
          .sort((a, b) => a.id - b.id),
        invoice: invoice
          ? {
              additional_fee: num(invoice.additional_fee),
              additional_fee_currency: currencyOf(invoice.additional_fee_currency),
              additional_note: invoice.additional_note || '',
            }
          : { additional_fee: 0, additional_fee_currency: 'IDR', additional_note: '' },
      };
    });

    // Pelanggan bernama dulu (A-Z), grup tanpa pemilik paling bawah
    customers.sort((a, b) => {
      if (!a.owner) return 1;
      if (!b.owner) return -1;
      return a.owner.label.localeCompare(b.owner.label, 'id');
    });

    res.json({ batch, customers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Baris biaya tambahan (boleh banyak) ─────────────────────────────
//  Biaya lama yang masih menempel di batch_invoices dipindah jadi baris
//  pertama begitu pelanggan ini ditambahi baris baru, supaya ke depannya
//  semua biaya duduk di satu tempat.
async function migrateLegacyFee(batchId, ownerId) {
  const { data: old } = await supabase
    .from('batch_invoices')
    .select('additional_fee, additional_fee_currency, additional_note')
    .eq('batch_id', batchId).eq('owner_code_id', ownerId).maybeSingle();
  if (!old || !num(old.additional_fee)) return;

  const { error } = await supabase.from('invoice_fees').insert({
    batch_id: batchId,
    owner_code_id: ownerId,
    label: old.additional_note || 'Biaya tambahan',
    amount: num(old.additional_fee),
    currency: currencyOf(old.additional_fee_currency),
  });
  if (error) return;

  await supabase.from('batch_invoices')
    .update({ additional_fee: 0, additional_note: null, updated_at: new Date().toISOString() })
    .eq('batch_id', batchId).eq('owner_code_id', ownerId);
}

router.post('/batch/:batchId/owner/:ownerId/fees', async (req, res) => {
  const batchId = parseInt(req.params.batchId);
  const ownerId = parseInt(req.params.ownerId);
  const amount = num(req.body.amount);
  if (!amount) return res.status(400).json({ error: 'Nominal biaya tidak boleh kosong' });

  try {
    await migrateLegacyFee(batchId, ownerId);
    const { data, error } = await supabase.from('invoice_fees').insert({
      batch_id: batchId,
      owner_code_id: ownerId,
      label: req.body.label?.trim() || null,
      amount: Math.max(0, amount),
      currency: currencyOf(req.body.currency),
    }).select().single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch {
    res.status(503).json({
      error: 'Biaya tambahan bertingkat belum aktif — jalankan supabase/migrations/014_invoice_fees_package_payments.sql',
    });
  }
});

// Biaya lama yang menempel di kolom box dipindah jadi baris pertama
async function migrateLegacyBoxFee(boxId) {
  const { data: box } = await supabase
    .from('boxes').select('additional_fee, additional_fee_currency, additional_note')
    .eq('id', boxId).maybeSingle();
  if (!box || !num(box.additional_fee)) return;

  const { error } = await supabase.from('invoice_fees').insert({
    box_id: boxId,
    label: box.additional_note || 'Biaya tambahan',
    amount: num(box.additional_fee),
    currency: currencyOf(box.additional_fee_currency),
  });
  if (error) return;

  await supabase.from('boxes')
    .update({ additional_fee: 0, additional_note: null })
    .eq('id', boxId);
}

router.post('/box/:boxId/fees', async (req, res) => {
  const boxId = parseInt(req.params.boxId);
  const amount = num(req.body.amount);
  if (!amount) return res.status(400).json({ error: 'Nominal biaya tidak boleh kosong' });

  try {
    await migrateLegacyBoxFee(boxId);
    const { data, error } = await supabase.from('invoice_fees').insert({
      box_id: boxId,
      label: req.body.label?.trim() || null,
      amount: Math.max(0, amount),
      currency: currencyOf(req.body.currency),
    }).select().single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch {
    res.status(503).json({
      error: 'Biaya tambahan untuk box belum aktif — jalankan supabase/migrations/015_invoice_fees_box.sql',
    });
  }
});

router.delete('/fees/:feeId', async (req, res) => {
  const { error } = await supabase.from('invoice_fees').delete().eq('id', req.params.feeId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── Simpan additional fee manual untuk satu pelanggan di satu batch ──
router.put('/batch/:batchId/owner/:ownerId', async (req, res) => {
  const { batchId, ownerId } = req.params;
  const { additional_fee, additional_fee_currency, additional_note } = req.body;

  const payload = {
    batch_id: parseInt(batchId),
    owner_code_id: parseInt(ownerId),
    additional_fee: Math.max(0, num(additional_fee)),
    additional_fee_currency: currencyOf(additional_fee_currency),
    additional_note: additional_note?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('batch_invoices')
    .upsert(payload, { onConflict: 'batch_id,owner_code_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Invoice satu box (Warehouse) ────────────────────────────────────
//  Judulnya ikut paket kalau pelanggan berpaket:
//    "Paket A periode 1 - Box 3", selain itu cukup "Box 3".
router.get('/box/:boxId', async (req, res) => {
  try {
    const { data: box, error: boxErr } = await supabase
      .from('boxes').select('*').eq('id', req.params.boxId).single();
    if (boxErr || !box) return res.status(404).json({ error: 'Box tidak ditemukan' });

    const [{ data: rows, error }, codes, { data: pkgs }] = await Promise.all([
      supabase.from('wh_parcels').select('*').eq('box_id', box.id),
      fetchCodes(),
      supabase.from('customer_packages').select('*')
        .eq('owner_code_id', box.owner_code_id).eq('status', 'active').limit(1),
    ]);
    if (error) return res.status(500).json({ error: error.message });

    const parcels = attachOwners(rows || [], codes);
    const owner = codes.find(c => String(c.id) === String(box.owner_code_id)) || null;
    const pkg = pkgs?.[0] || null;
    const title = pkg ? `${pkg.name} periode ${pkg.period_no} - ${box.name}` : box.name;

    const feeRows = await supabase.from('invoice_fees').select('*').eq('box_id', box.id);
    const fees = (feeRows.data || [])
      .map(f => ({ id: f.id, label: f.label || '', amount: num(f.amount), currency: currencyOf(f.currency) }))
      .sort((a, b) => a.id - b.id);

    const totals = emptyTotals();
    for (const p of parcels) addParcel(totals, p, 'WH');
    if (num(box.additional_fee)) {
      totals[currencyOf(box.additional_fee_currency)].additional += num(box.additional_fee);
    }
    for (const fee of fees) totals[fee.currency].additional += fee.amount;

    res.json({
      batch: { id: box.id, type: 'WH', batch_number: box.name, label: title, status: box.status },
      box: { ...box, owner: owner && { id: owner.id, label: owner.label, code: owner.code } },
      customers: [{
        owner: owner && { id: owner.id, label: owner.label, code: owner.code },
        parcels: parcels.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        parcel_count: parcels.length,
        totals: finalize(totals),
        fees,
        box_title: title,
        invoice: {
          additional_fee: num(box.additional_fee),
          additional_fee_currency: currencyOf(box.additional_fee_currency),
          additional_note: box.additional_note || '',
        },
      }],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Simpan additional fee manual pada box ───────────────────────────
router.put('/box/:boxId/extra', async (req, res) => {
  const { additional_fee, additional_fee_currency, additional_note } = req.body;
  const { data, error } = await supabase
    .from('boxes')
    .update({
      additional_fee: Math.max(0, num(additional_fee)),
      additional_fee_currency: currencyOf(additional_fee_currency),
      additional_note: additional_note?.trim() || null,
    })
    .eq('id', req.params.boxId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Tandai resi lunas / batal lunas ─────────────────────────────────
//  body: { type: 'HC'|'WH', parcel_ids: [...], paid: true|false,
//          batch_id, owner_code_id }
//  Saat ditandai lunas, additional fee manual pelanggan itu di batch ini
//  ikut direset — tagihan berikutnya mulai dari nol.
router.post('/pay', async (req, res) => {
  const { type, parcel_ids, paid = true, batch_id, owner_code_id } = req.body;
  const table = TABLE[String(type).toUpperCase()];
  if (!table || !Array.isArray(parcel_ids) || !parcel_ids.length) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  const { error } = await supabase
    .from(table)
    .update({ paid_at: paid ? new Date().toISOString() : null })
    .in('id', parcel_ids);
  if (error) return res.status(500).json({ error: error.message });

  if (paid && batch_id && owner_code_id) {
    await supabase
      .from('batch_invoices')
      .update({ additional_fee: 0, additional_note: null, updated_at: new Date().toISOString() })
      .eq('batch_id', batch_id)
      .eq('owner_code_id', owner_code_id);
  }

  const { data: owner } = owner_code_id
    ? await supabase.from('access_codes').select('label').eq('id', owner_code_id).single()
    : { data: null };

  logActivity({
    action: paid ? 'invoice_paid' : 'invoice_unpaid',
    summary: `${paid ? 'Tandai lunas' : 'Batalkan lunas'} ${parcel_ids.length} resi${owner?.label ? ` milik ${owner.label}` : ''}`,
    ref_type: 'batch',
    ref_id: batch_id,
  });

  res.json({ success: true });
});

module.exports = router;
