import { useState } from 'react';
import { fetchAsUser } from '../utils/format';

const emptyRow = () => ({
  tracking_number: '',
  need_unboxing: false,
  parcel_type: 'barang',
  quantity: '',
  recipient_name: '',
  freebies_stay: false,
  notes: '',
  coPhoto: null,
  coPreview: null,
});

export default function RequestForm({ type, unboxingFee = 0.75, onSubmitted }) {
  const [items, setItems]     = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  function updateRow(idx, field, value) {
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function handleCoPhoto(idx, file) {
    if (!file) return;
    setItems(prev => prev.map((r, i) =>
      i === idx ? { ...r, coPhoto: file, coPreview: URL.createObjectURL(file) } : r
    ));
  }

  function addRow() {
    if (items.length >= 10) return;
    setItems(prev => [...prev, emptyRow()]);
  }

  function removeRow(idx) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    for (const [i, item] of items.entries()) {
      if (!item.tracking_number.trim()) {
        setError(`Resi #${i + 1}: nomor resi wajib diisi`);
        return;
      }
      if (item.parcel_type === 'paperbased' && !(parseInt(item.quantity) >= 1)) {
        setError(`Resi #${i + 1}: jumlah paperbased wajib diisi`);
        return;
      }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('type', type);

      // Append items as JSON (without file objects)
      const itemsData = items.map(({ tracking_number, parcel_type, notes, need_unboxing, quantity, recipient_name, freebies_stay }) => ({
        tracking_number, parcel_type, notes, need_unboxing: type === 'WH' && need_unboxing,
        recipient_name, freebies_stay,
        quantity: parcel_type === 'paperbased' ? parseInt(quantity) || null : null,
      }));
      fd.append('items', JSON.stringify(itemsData));

      // Append CO photos by index
      items.forEach((item, i) => {
        if (item.coPhoto) fd.append(`co_photo_${i}`, item.coPhoto);
      });

      const res = await fetchAsUser('/api/requests', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal mengirim'); return; }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setItems([emptyRow()]);
        onSubmitted?.();
      }, 2500);
    } catch {
      setError('Koneksi gagal');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-bold text-green-700">Resi berhasil disetor!</p>
        <p className="text-sm text-green-600 mt-1">Admin akan segera memproses resimu</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-50 border-b border-matcha-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{type === 'HC' ? '✈️' : '🏭'}</span>
          <div>
            <p className="text-sm font-bold text-matcha-800">Setor Resi {type === 'HC' ? 'Hand Carry' : 'Warehouse'}</p>
            <p className="text-xs text-gray-500">{items.length}/10 resi</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="bg-cream-50 rounded-xl p-3 border border-cream-200 space-y-2">
            {/* Row header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-matcha-600 bg-matcha-100 px-2 py-0.5 rounded-full">
                Resi #{idx + 1}
              </span>
              {items.length > 1 && (
                <button type="button" onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-400 transition-colors text-xs">
                  ✕ Hapus
                </button>
              )}
            </div>

            {/* Tracking number */}
            <input
              className="input-field font-mono text-sm"
              placeholder="Nomor resi (cth: JD1234567890)"
              value={item.tracking_number}
              onChange={e => updateRow(idx, 'tracking_number', e.target.value)}
              required
            />

            {/* Penerima — opsional, untuk penerima yang beda dengan pemilik akun */}
            <input
              className="input-field text-sm"
              placeholder="Nama penerima (opsional — kosongkan kalau sama dengan namamu)"
              value={item.recipient_name}
              onChange={e => updateRow(idx, 'recipient_name', e.target.value)}
            />

            {/* Type + Notes */}
            <div className="flex gap-2">
              <select
                value={item.parcel_type}
                onChange={e => updateRow(idx, 'parcel_type', e.target.value)}
                className="input-field text-sm flex-shrink-0 w-36"
              >
                <option value="barang">📦 Barang</option>
                <option value="paperbased">📄 Paperbased</option>
              </select>
              <input
                className="input-field text-sm flex-1"
                placeholder="Catatan (opsional)"
                value={item.notes}
                onChange={e => updateRow(idx, 'notes', e.target.value)}
              />
            </div>

            {/* Jumlah wajib untuk paperbased */}
            {item.parcel_type === 'paperbased' && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-sky-200 bg-sky-50">
                <span className="text-sm">📄</span>
                <span className="text-xs font-semibold text-gray-700">Jumlah</span>
                <input
                  type="number" min="1" required
                  value={item.quantity}
                  onChange={e => updateRow(idx, 'quantity', e.target.value)}
                  className="input-field text-sm py-1.5 w-24"
                  placeholder="cth: 5"
                />
                <span className="text-xs text-sky-700">pcs · wajib untuk paperbased</span>
              </div>
            )}

            {/* Freebies tinggal — opsional */}
            <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
              item.freebies_stay ? 'border-pink-300 bg-pink-50' : 'border-cream-200 bg-white hover:border-pink-200'
            }`}>
              <input
                type="checkbox"
                checked={item.freebies_stay}
                onChange={e => updateRow(idx, 'freebies_stay', e.target.checked)}
                className="w-4 h-4 accent-pink-600"
              />
              <span className="text-sm">🎁</span>
              <span className="flex-1 text-xs font-semibold text-gray-700">Freebies tinggal / stay</span>
              <span className="text-[11px] text-gray-400">opsional</span>
            </label>

            {/* Video unboxing — khusus Warehouse, ada biaya tambahan */}
            {type === 'WH' && (
              <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 cursor-pointer transition-colors ${
                item.need_unboxing ? 'border-violet-300 bg-violet-50' : 'border-cream-200 bg-white hover:border-violet-200'
              }`}>
                <input
                  type="checkbox"
                  checked={item.need_unboxing}
                  onChange={e => updateRow(idx, 'need_unboxing', e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <span className="text-sm">🎥</span>
                <span className="flex-1 text-xs font-semibold text-gray-700">Need video unboxing</span>
                <span className="text-xs font-bold text-violet-700">+ ¥ {Number(unboxingFee).toLocaleString('id-ID')}</span>
              </label>
            )}

            {/* CO Photo */}
            <div>
              <p className="text-xs text-gray-500 mb-1">🗂 Foto CO <span className="text-gray-400">(opsional)</span></p>
              {item.coPreview ? (
                <div className="relative">
                  <img src={item.coPreview} alt="CO" className="w-full h-28 object-cover rounded-lg border border-amber-200" />
                  <label className="absolute bottom-2 right-2 bg-white/90 text-xs text-amber-600 font-medium px-2 py-1 rounded-lg cursor-pointer border border-amber-200 hover:bg-amber-50 transition-colors">
                    Ganti
                    <input type="file" accept="image/*" className="sr-only" onChange={e => handleCoPhoto(idx, e.target.files[0])} />
                  </label>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full p-2.5 border-2 border-dashed border-amber-200 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50 text-amber-500 text-xs transition-colors">
                  <span>🗂</span>
                  <span>Upload foto CO</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={e => handleCoPhoto(idx, e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
        ))}

        {/* Add row */}
        {items.length < 10 && (
          <button
            type="button"
            onClick={addRow}
            className="w-full py-2 rounded-xl border-2 border-dashed border-matcha-200 text-matcha-500 text-sm font-medium hover:border-matcha-400 hover:bg-matcha-50 transition-all"
          >
            + Tambah Resi Lagi ({10 - items.length} tersisa)
          </button>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">⚠️ {error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? 'Menyetor...' : `📨 Setor ${items.length} Resi`}
        </button>
      </form>
    </div>
  );
}
