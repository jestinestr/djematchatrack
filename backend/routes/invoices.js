const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes, attachOwners } = require('../lib/owner');

const TABLE = { HC: 'hc_parcels', WH: 'wh_parcels' };
const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const currencyOf = v => (String(v).toUpperCase() === 'CNY' ? 'CNY' : 'IDR');

const emptyTotals = () => ({
  IDR: { fee: 0, additional: 0, fine: 0, total: 0 },
  CNY: { fee: 0, additional: 0, fine: 0, total: 0 },
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
}

function finalize(totals) {
  for (const cur of ['IDR', 'CNY']) {
    const t = totals[cur];
    t.total = t.fee + t.additional + t.fine;
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
      if (invoice) {
        // Additional fee manual dari invoice ikut masuk total
        const cur = currencyOf(invoice.additional_fee_currency);
        g.totals[cur].additional += num(invoice.additional_fee);
      }
      return {
        owner: g.owner,
        parcels: g.parcels.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        parcel_count: g.parcels.length,
        totals: finalize(g.totals),
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

module.exports = router;
