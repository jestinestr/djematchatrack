import { useState } from 'react';

const emptyRow = () => ({ tracking_number: '', recipient_name: '', parcel_type: 'barang', notes: '' });

export default function RequestForm({ type, onSubmitted }) {
  const [items, setItems]     = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  function updateRow(idx, field, value) {
    setItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
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

    // Validate
    for (const [i, item] of items.entries()) {
      if (!item.tracking_number.trim() || !item.recipient_name.trim()) {
        setError(`Baris ${i + 1}: nomor resi dan nama penerima wajib diisi`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal mengirim'); return; }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setItems([emptyRow()]);
        onSubmitted?.();
      }, 2000);
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
        <p className="font-bold text-green-700">Request terkirim!</p>
        <p className="text-sm text-green-600 mt-1">Admin akan segera memproses resimu</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
      {/* Form header */}
      <div className="px-4 py-3 bg-matcha-50 border-b border-matcha-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{type === 'HC' ? '✈️' : '🏭'}</span>
          <div>
            <p className="text-sm font-bold text-matcha-800">Request Resi {type === 'HC' ? 'Hand Carry' : 'Warehouse'}</p>
            <p className="text-xs text-gray-500">{items.length}/10 resi</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Rows */}
        {items.map((item, idx) => (
          <div key={idx} className="bg-cream-50 rounded-xl p-3 border border-cream-200 space-y-2">
            {/* Row number + remove */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-matcha-600 bg-matcha-100 px-2 py-0.5 rounded-full">
                Resi #{idx + 1}
              </span>
              {items.length > 1 && (
                <button type="button" onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-400 transition-colors text-sm">
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

            {/* Recipient name */}
            <input
              className="input-field text-sm"
              placeholder="Nama penerima"
              value={item.recipient_name}
              onChange={e => updateRow(idx, 'recipient_name', e.target.value)}
              required
            />

            {/* Type + Notes row */}
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
          </div>
        ))}

        {/* Add row button */}
        {items.length < 10 && (
          <button
            type="button"
            onClick={addRow}
            className="w-full py-2 rounded-xl border-2 border-dashed border-matcha-200 text-matcha-500 text-sm font-medium hover:border-matcha-400 hover:bg-matcha-50 transition-all flex items-center justify-center gap-1.5"
          >
            <span>+</span> Tambah Resi Lagi ({10 - items.length} tersisa)
          </button>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
            ⚠️ {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? 'Mengirim...' : `📨 Kirim ${items.length} Request`}
        </button>
      </form>
    </div>
  );
}
