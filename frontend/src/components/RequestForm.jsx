import { useState } from 'react';

const emptyRow = () => ({
  tracking_number: '',
  recipient_name: '',
  parcel_type: 'barang',
  notes: '',
  coPhoto: null,
  coPreview: null,
});

export default function RequestForm({ type, onSubmitted }) {
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
      if (!item.tracking_number.trim() || !item.recipient_name.trim()) {
        setError(`Resi #${i + 1}: nomor resi dan nama penerima wajib diisi`);
        return;
      }
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('type', type);

      // Append items as JSON (without file objects)
      const itemsData = items.map(({ tracking_number, recipient_name, parcel_type, notes }) => ({
        tracking_number, recipient_name, parcel_type, notes,
      }));
      fd.append('items', JSON.stringify(itemsData));

      // Append CO photos by index
      items.forEach((item, i) => {
        if (item.coPhoto) fd.append(`co_photo_${i}`, item.coPhoto);
      });

      const res = await fetch('/api/requests', { method: 'POST', body: fd });
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

            {/* Recipient */}
            <input
              className="input-field text-sm"
              placeholder="Nama penerima"
              value={item.recipient_name}
              onChange={e => updateRow(idx, 'recipient_name', e.target.value)}
              required
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
