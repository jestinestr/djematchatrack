import { useState } from 'react';
import { fetchAsUser } from '../utils/format';

// Pelanggan membetulkan sendiri data resinya.
//
// Dulu kalau ada yang keliru, pelanggan harus menyetor "permintaan
// perbaikan" lalu menunggu admin membetulkan. Padahal yang paling tahu isi
// paketnya ya pelanggan sendiri — jadi untuk kolom yang memang miliknya,
// dia boleh langsung mengubah.
//
// Biaya, denda, box, dan foto arrival tetap wilayah admin; servernya yang
// menjaga itu, di sini cuma kolom yang boleh disentuh yang ditampilkan.
export default function MyParcelEdit({ parcel, type, unboxingFee = 0.75, onSaved }) {
  const isWH = String(type || '').toUpperCase() === 'WH';
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    recipient_name: parcel.recipient_name || '',
    parcel_type: parcel.type === 'paperbased' ? 'paperbased' : 'barang',
    quantity: String(parcel.estimated_quantity || 1),
    need_unboxing: !!parcel.need_unboxing,
    freebies_stay: !!parcel.freebies_stay,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (!form.recipient_name.trim()) { setError('Nama penerima tidak boleh kosong'); return; }
    setSaving(true);
    setError('');
    try {
      const kind = isWH ? 'wh' : 'hc';
      const res = await fetchAsUser(`/api/parcels/${kind}/${parcel.id}/mine`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: form.recipient_name.trim(),
          parcel_type: form.parcel_type,
          quantity: form.quantity,
          ...(isWH ? { need_unboxing: form.need_unboxing } : {}),
          freebies_stay: form.freebies_stay,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setDone(true);
      setTimeout(() => { setDone(false); setOpen(false); onSaved?.(data); }, 1200);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-cream-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-bold text-gray-700">✏️ Ada yang keliru? Betulkan sendiri</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <form onSubmit={save} className="px-4 pb-4 pt-1 space-y-3 border-t-2 border-cream-100">
          {done && (
            <p className="text-xs font-bold text-green-700 bg-green-50 rounded-xl px-3 py-2">
              ✅ Tersimpan, terima kasih!
            </p>
          )}
          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Nama penerima</label>
            <input value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)}
              className="input-field" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Jenis paket</label>
              <select value={form.parcel_type} onChange={e => set('parcel_type', e.target.value)}
                className="input-field">
                <option value="barang">📦 Barang</option>
                <option value="paperbased">📄 Paperbased</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                {form.parcel_type === 'paperbased' ? 'Jumlah pcs' : 'Jumlah'}
              </label>
              <input type="number" min="1" inputMode="numeric" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} className="input-field" />
            </div>
          </div>

          {isWH && (
            <label className="flex items-start gap-2.5 p-3 rounded-2xl border-2 border-violet-200 bg-violet-50 cursor-pointer">
              <input type="checkbox" checked={form.need_unboxing}
                onChange={e => set('need_unboxing', e.target.checked)}
                className="mt-0.5 accent-violet-600" />
              <span className="text-xs text-violet-900 leading-snug">
                Minta video unboxing
                <span className="block text-violet-700/80">Biaya ¥{unboxingFee} per resi, ikut masuk tagihan</span>
              </span>
            </label>
          )}

          <label className="flex items-start gap-2.5 p-3 rounded-2xl border-2 border-pink-200 bg-pink-50 cursor-pointer">
            <input type="checkbox" checked={form.freebies_stay}
              onChange={e => set('freebies_stay', e.target.checked)}
              className="mt-0.5 accent-pink-500" />
            <span className="text-xs text-pink-900 leading-snug">
              Freebies ditinggal di gudang
            </span>
          </label>

          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
          <p className="text-[11px] text-gray-400 text-center leading-snug">
            Biaya, denda, dan foto arrival diatur admin — kalau itu yang keliru, kabari admin ya.
          </p>
        </form>
      )}
    </div>
  );
}
