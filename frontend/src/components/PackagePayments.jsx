import { useEffect, useState } from 'react';
import { money, formatDate } from '../utils/format';

// Pembayaran paket WH: DP boleh dicicil beberapa kali, statusnya dihitung
// dari jumlah bayar dibanding harga paket — jadi tidak ada status yang bisa
// ketinggalan zaman saat ada cicilan baru masuk.
//
// Harga paket dicatat dalam Yuan, sama seperti tarif WH lainnya.

export const PAYMENT_TONE = {
  lunas: 'bg-green-100 text-green-700 border-green-300',
  dp:    'bg-amber-100 text-amber-700 border-amber-300',
  belum: 'bg-red-100 text-red-700 border-red-300',
  none:  'bg-cream-200 text-gray-500 border-cream-300',
};

export const PAYMENT_LABEL = {
  lunas: '✓ Lunas',
  dp:    'DP',
  belum: 'Belum bayar',
  none:  'Tanpa harga',
};

export function PaymentBadge({ pkg }) {
  const status = pkg.payment_status || 'none';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${PAYMENT_TONE[status]}`}>
      {PAYMENT_LABEL[status]}
      {status === 'dp' && ` ${money(pkg.paid, 'CNY')}`}
    </span>
  );
}

export default function PackagePayments({ pkg, onChanged }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', note: '' });
  const [price, setPrice] = useState(String(pkg.price || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    fetch(`/api/packages/${pkg.id}/payments`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Gagal memuat pembayaran');
        return body;
      })
      .then(d => { setRows(d); setError(''); })
      .catch(e => setError(e.message));
  }, [open, pkg.id]);

  async function add(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/packages/${pkg.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: form.note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Gagal menyimpan');
      setRows(r => [...r, body]);
      setForm({ amount: '', note: '' });
      onChanged?.();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Hapus catatan pembayaran ini?')) return;
    await fetch(`/api/packages/payments/${id}`, { method: 'DELETE' });
    setRows(r => r.filter(x => x.id !== id));
    onChanged?.();
  }

  // Paket lama sering dibuat tanpa harga; tanpa itu status lunas tidak bisa
  // dihitung, jadi harganya bisa diisi langsung dari sini.
  async function savePrice(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch(`/api/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: Number(price) || 0 }),
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const lunas = pkg.payment_status === 'lunas';

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)}
        className="text-[11px] font-semibold text-gray-500 hover:text-matcha-700">
        {open ? '▲' : '▼'} Pembayaran
        {pkg.price > 0 && (
          <span className="ml-1 text-gray-400">
            · {money(pkg.paid, 'CNY')} dari {money(pkg.price, 'CNY')}
            {!lunas && ` · sisa ${money(pkg.due, 'CNY')}`}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-cream-200 bg-cream-50 p-3 space-y-2">
          {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}

          {!pkg.price && (
            <form onSubmit={savePrice} className="flex items-end gap-2">
              <div className="w-28">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Harga paket (¥)</label>
                <input type="number" min="0" step="0.01" value={price} required
                  onChange={e => setPrice(e.target.value)}
                  className="input-field text-xs py-1.5" placeholder="0" />
              </div>
              <button type="submit" disabled={busy}
                className="text-xs font-bold px-3 py-2 rounded-xl bg-cream-200 text-matcha-800 disabled:opacity-50">
                Simpan harga
              </button>
              <p className="text-[11px] text-gray-400 flex-1">
                Harga belum diisi, jadi status lunas belum bisa dihitung
              </p>
            </form>
          )}

          {rows.length === 0 && !error && (
            <p className="text-[11px] text-gray-400">Belum ada pembayaran tercatat</p>
          )}

          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-white rounded-xl px-2.5 py-1.5">
              <span className="text-gray-400 w-24 flex-shrink-0">{formatDate(r.paid_at, false)}</span>
              <span className="flex-1 truncate text-gray-500">{r.note || '—'}</span>
              <span className="font-bold text-matcha-700 whitespace-nowrap">{money(r.amount, 'CNY')}</span>
              <button onClick={() => remove(r.id)} title="Hapus"
                className="text-gray-300 hover:text-red-500 px-1">✕</button>
            </div>
          ))}

          <form onSubmit={add} className="flex items-end gap-2 pt-1">
            <div className="w-24">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Bayar (¥)</label>
              <input type="number" min="0" step="0.01" value={form.amount} required
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="input-field text-xs py-1.5" placeholder="0" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Keterangan</label>
              <input type="text" value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="input-field text-xs py-1.5" placeholder="cth: DP transfer BCA" />
            </div>
            <button type="submit" disabled={busy}
              className="btn-primary text-xs px-3 py-2 disabled:opacity-50">
              {busy ? '...' : '+ Catat'}
            </button>
          </form>

          {pkg.price > 0 && pkg.due > 0 && (
            <button
              onClick={() => { setForm({ amount: String(pkg.due), note: 'Pelunasan' }); }}
              className="text-[11px] font-semibold text-matcha-700 hover:underline">
              Isi sisa {money(pkg.due, 'CNY')} sebagai pelunasan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
