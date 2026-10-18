import { useEffect, useState } from 'react';
import { CURRENCIES, money, rupiah, formatDate } from '../utils/format';

// Penagihan yang sudah dicetak dan sedang ditunggu bayarannya.
//
// Tagihan bisa campur Yuan dan Rupiah, jadi pembayaran dicatat beserta mata
// uangnya dan kurang/lebihnya dihitung per mata uang — bukan dijumlahkan
// jadi satu angka yang menyesatkan.
export default function BillingList({ list, onPaid, onRemove, onOpen, onPrint, onChanged }) {
  if (!list.length) return null;

  return (
    <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200">
        <span className="text-base leading-none">🧾</span>
        <p className="text-xs font-bold text-amber-900 flex-1">
          Penagihan berjalan ({list.length})
        </p>
        <span className="text-[11px] text-amber-700/80 hidden sm:block">
          Invoice yang sudah dicetak, menunggu dibayar
        </span>
      </div>

      <div className="divide-y divide-amber-100">
        {list.map(b => (
          <BillingRow key={b.id} bill={b} onPaid={onPaid} onRemove={onRemove}
            onOpen={onOpen} onPrint={onPrint} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

// Selisih tagihan vs pembayaran, ditulis per mata uang.
//  v > 0 → masih kurang bayar
//  v < 0 → kelebihan bayar, jadi titipan untuk invoice berikutnya
export const selisihBayar = bill => [
  { cur: 'IDR', v: bill.due_idr ?? bill.total_idr },
  { cur: 'CNY', v: bill.due_cny ?? bill.total_cny },
].filter(x => Math.abs(x.v || 0) > 0.009);

function BillingRow({ bill, onPaid, onRemove, onOpen, onPrint, onChanged }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ amount: '', currency: 'CNY', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    fetch(`/api/billings/${bill.id}/payments`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Gagal memuat pembayaran');
        return body;
      })
      .then(d => { setRows(d); setError(''); })
      .catch(e => setError(e.message));
  }, [open, bill.id]);

  async function bayar(e) {
    e.preventDefault();
    if (!Number(form.amount)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/billings/${bill.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setRows(r => [...r, data]);
      setForm(f => ({ ...f, amount: '', note: '' }));
      onChanged?.();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function hapusBayar(id) {
    await fetch(`/api/billings/payments/${id}`, { method: 'DELETE' });
    setRows(r => r.filter(x => x.id !== id));
    onChanged?.();
  }

  const total = [bill.total_idr ? money(bill.total_idr, 'IDR') : null,
                 bill.total_cny ? money(bill.total_cny, 'CNY') : null]
    .filter(Boolean).join(' + ') || '—';

  const selisih = selisihBayar(bill);
  const adaBayar = (bill.paid_idr || 0) > 0 || (bill.paid_cny || 0) > 0;

  // Kurs invoice ini tercatat → tagihannya boleh dibayar pakai Rupiah,
  // berapa pun bagian yang tadinya dalam Yuan.
  const kurs = Number(bill.rate || bill.cny_rate) || 0;
  const sisaRupiah = kurs > 0 ? Number(bill.due_equiv_idr ?? 0) : 0;

  function isiSisaRupiah() {
    setForm(f => ({
      ...f,
      amount: String(Math.round(sisaRupiah)),
      currency: 'IDR',
    }));
  }

  return (
    <div className="bg-white/60">
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
        <button onClick={() => onOpen(bill)} className="min-w-0 flex-1 text-left group">
          <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-matcha-700">
            {bill.title}
          </p>
          <p className="text-[11px] text-gray-500">
            {bill.parcel_count} resi · dicetak {formatDate(bill.issued_at, false)}
          </p>
        </button>

        <div className="text-right whitespace-nowrap">
          <p className="text-sm font-bold text-amber-800">{total}</p>
          {kurs > 0 && sisaRupiah > 0 && (
            <p className="text-[11px] text-gray-500">
              sisa ≈ {rupiah(sisaRupiah)} · kurs ¥1 = {rupiah(kurs)}
            </p>
          )}
          {adaBayar && (
            <p className="text-[11px] font-semibold">
              {selisih.length === 0
                ? <span className="text-green-600">pas, tinggal tandai lunas</span>
                : selisih.map(x => (
                    <span key={x.cur} className={x.v > 0 ? 'text-berry-600' : 'text-matcha-700'}>
                      {x.v > 0 ? 'kurang ' : 'lebih '}{money(Math.abs(x.v), x.cur)}{' '}
                    </span>
                  ))}
            </p>
          )}
        </div>

        <button onClick={() => onPrint?.(bill)} title="Lihat & cetak ulang invoicenya"
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-cream-300 bg-white text-gray-600 hover:bg-cream-50 whitespace-nowrap">
          🖨 Lihat
        </button>
        <button onClick={() => setOpen(v => !v)} title="Catat pembayaran"
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 whitespace-nowrap">
          💰 Bayar
        </button>
        <button onClick={() => onPaid(bill, true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white whitespace-nowrap">
          ✓ Lunas
        </button>
        <button onClick={() => onRemove(bill)} title="Buang dari daftar"
          className="text-gray-300 hover:text-red-500 px-1">✕</button>
      </div>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}

          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-white rounded-xl px-2.5 py-1.5">
              <span className="text-gray-400 w-20 flex-shrink-0">{formatDate(r.paid_at, false)}</span>
              <span className="flex-1 truncate text-gray-500">{r.note || '—'}</span>
              <span className="font-bold text-matcha-700 whitespace-nowrap">
                {money(r.amount, r.currency)}
              </span>
              <button onClick={() => hapusBayar(r.id)} title="Hapus"
                className="text-gray-300 hover:text-red-500 px-1">✕</button>
            </div>
          ))}
          {!rows.length && !error && (
            <p className="text-[11px] text-gray-400">Belum ada pembayaran tercatat</p>
          )}

          <form onSubmit={bayar} className="flex items-end gap-2 flex-wrap">
            <div className="w-28">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nominal</label>
              <input type="number" min="0" step="0.01" value={form.amount} required
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="input-field text-xs py-1.5" placeholder="0" />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mata uang</label>
              <select value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="input-field text-xs py-1.5">
                {Object.entries(CURRENCIES).map(([code, c]) => (
                  <option key={code} value={code}>{c.symbol} {code}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Keterangan</label>
              <input type="text" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="input-field text-xs py-1.5" placeholder="cth: transfer BCA" />
            </div>
            <button type="submit" disabled={busy}
              className="btn-primary text-xs px-3 py-2 disabled:opacity-50">
              {busy ? '...' : '+ Catat'}
            </button>
          </form>

          {kurs > 0 && sisaRupiah > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={isiSisaRupiah}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-matcha-300 bg-white text-matcha-700 hover:bg-matcha-50">
                Isi sisa dalam Rupiah ({rupiah(sisaRupiah)})
              </button>
              <span className="text-[11px] text-gray-400">
                dihitung dengan kurs invoice ini, ¥1 = {rupiah(kurs)}
              </span>
            </div>
          )}

          {adaBayar && selisih.length > 0 && (
            <p className="text-[11px] text-gray-500 leading-snug">
              {selisih.some(x => x.v > 0)
                ? 'Masih kurang. Selama belum ditandai lunas, sisanya ikut ditagih di invoice berikutnya.'
                : 'Kelebihan bayar ini jadi potongan di invoice berikutnya.'}
            </p>
          )}

          {kurs > 0 && (
            <p className="text-[11px] text-gray-400 leading-snug">
              Bayaran Rupiah otomatis menutup tagihan Yuan memakai kurs invoice ini
              (¥1 = {rupiah(kurs)}), jadi angkanya tidak ikut berubah kalau kurs hari ini bergeser.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
