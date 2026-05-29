import { useState } from 'react';

// Pass `parcel` prop to enter edit mode (pre-fills form, calls PATCH instead of POST)
export default function AddParcelModal({ type, batchId, parcel, onClose, onAdded, onEdited }) {
  const isHC = type === 'HC';
  const isEdit = !!parcel;

  const [form, setForm] = useState({
    recipient_name: parcel?.recipient_name || '',
    tracking_number: parcel?.tracking_number || '',
    parcel_type: parcel?.type || 'barang',
    estimated_weight_grams: parcel?.estimated_weight_grams?.toString() || '',
    estimated_quantity: parcel?.estimated_quantity?.toString() || '1',
    wh_fee: parcel?.wh_fee?.toString() || '',
    is_manual_input: parcel?.is_manual_input || false,
  });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(parcel?.photo_url || null);
  const [coPhoto, setCoPhoto] = useState(null);
  const [coPreview, setCoPreview] = useState(parcel?.co_photo_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleCoPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCoPhoto(file);
    setCoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fd = new FormData();
    if (!isEdit) fd.append('batch_id', batchId);
    fd.append('tracking_number', form.tracking_number);
    fd.append('recipient_name', form.recipient_name);
    fd.append('type', form.parcel_type);
    fd.append('is_manual_input', form.is_manual_input ? 'true' : 'false');
    if (photo) fd.append('photo', photo);
    if (coPhoto) fd.append('co_photo', coPhoto);

    if (isHC) {
      fd.append('estimated_weight_grams', form.estimated_weight_grams || '0');
      fd.append('estimated_quantity', form.estimated_quantity || '1');
    } else {
      fd.append('wh_fee', form.wh_fee || '0');
    }

    const endpoint = isHC ? 'hc' : 'wh';
    const url = isEdit ? `/api/parcels/${endpoint}/${parcel.id}` : `/api/parcels/${endpoint}`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan resi'); return; }
      if (isEdit) {
        onEdited?.(data);
      } else {
        onAdded?.(data);
      }
      onClose();
    } catch {
      setError('Koneksi gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-matcha-800">
            {isEdit ? '✏️ Edit Resi' : `Tambah Resi ${isHC ? '✈️ HC' : '🏭 WH'}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penerima <span className="text-red-500">*</span></label>
            <input
              className="input-field"
              value={form.recipient_name}
              onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
              placeholder="Nama lengkap penerima"
              required
            />
          </div>

          {/* Tracking number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Resi <span className="text-red-500">*</span></label>
            <input
              className="input-field font-mono"
              value={form.tracking_number}
              onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
              placeholder="JD1234567890..."
              required
            />
          </div>

          {/* Parcel type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Paket <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {['barang', 'paperbased'].map(t => (
                <label key={t} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.parcel_type === t ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input type="radio" name="parcel_type" value={t} checked={form.parcel_type === t} onChange={() => setForm(f => ({ ...f, parcel_type: t }))} className="sr-only" />
                  <span>{t === 'barang' ? '📦' : '📄'}</span>
                  <span className="text-sm font-medium">{t === 'barang' ? 'Barang' : 'Paperbased'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* HC-specific */}
          {isHC && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimasi Berat (g)</label>
                <input type="number" min="0" className="input-field" value={form.estimated_weight_grams} onChange={e => setForm(f => ({ ...f, estimated_weight_grams: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty (pcs)</label>
                <input type="number" min="1" className="input-field" value={form.estimated_quantity} onChange={e => setForm(f => ({ ...f, estimated_quantity: e.target.value }))} placeholder="1" />
              </div>
            </div>
          )}

          {/* WH-specific */}
          {!isHC && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Biaya WH (Rp)</label>
              <input type="number" min="0" className="input-field" value={form.wh_fee} onChange={e => setForm(f => ({ ...f, wh_fee: e.target.value }))} placeholder="0" />
            </div>
          )}

          {/* Photos */}
          <div className="grid grid-cols-2 gap-3">
            {/* Foto Arrival / Unboxing */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📷 Foto Arrival
                <span className="text-xs text-gray-400 font-normal ml-1">(tampil ke user)</span>
              </label>
              {preview && (
                <img src={preview} alt="preview" className="w-full h-24 object-cover rounded-lg mb-1.5 border border-cream-200" />
              )}
              <label className="flex items-center justify-center gap-1.5 w-full p-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-matcha-400 text-gray-500 text-xs transition-colors">
                <span>📷</span>
                <span>{preview ? 'Ganti' : 'Pilih foto'}</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
              </label>
            </div>

            {/* Foto CO — admin only */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🗂 Foto CO
                <span className="text-xs text-amber-600 font-normal ml-1">(admin only)</span>
              </label>
              {coPreview && (
                <img src={coPreview} alt="co preview" className="w-full h-24 object-cover rounded-lg mb-1.5 border border-amber-200" />
              )}
              <label className="flex items-center justify-center gap-1.5 w-full p-2.5 border-2 border-dashed border-amber-300 rounded-xl cursor-pointer hover:border-amber-400 text-amber-500 text-xs transition-colors">
                <span>🗂</span>
                <span>{coPreview ? 'Ganti' : 'Pilih foto CO'}</span>
                <input type="file" accept="image/*" onChange={handleCoPhotoChange} className="sr-only" />
              </label>
            </div>
          </div>

          {/* Manual input flag */}
          <label className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
            <input type="checkbox" checked={form.is_manual_input} onChange={e => setForm(f => ({ ...f, is_manual_input: e.target.checked }))} className="w-4 h-4 accent-matcha-700" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Input Manual?</div>
              <div className="text-xs text-amber-600">Jika dicentang, denda Rp 2.000 otomatis ditambahkan</div>
            </div>
          </label>

          {form.is_manual_input && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <span>⚠️</span>
              <span>Denda <strong>Rp 2.000</strong> akan diterapkan pada resi ini</span>
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary">
              {loading ? 'Menyimpan...' : isEdit ? '💾 Simpan Perubahan' : 'Simpan Resi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
