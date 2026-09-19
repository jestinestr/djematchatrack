import { useEffect, useState } from 'react';
import { CURRENCIES, money, rupiah, normCurrency } from '../utils/format';
import LabelPrintModal from './LabelPrintModal';

// Judul kecil pemisah antar kelompok isian
function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <h3 className="text-[11px] font-bold text-matcha-700 uppercase tracking-wider whitespace-nowrap">
        {children}
      </h3>
      <div className="flex-1 h-px bg-cream-200" />
    </div>
  );
}

// Pass `parcel` prop to enter edit mode (pre-fills form, calls PATCH instead of POST)
export default function AddParcelModal({
  type,
  batchId,
  parcel,
  feePerGram = 0,
  feeCurrency = 'IDR',
  fineAmount = 0,
  unboxingFee = 0.75,
  batchNumber,
  onClose,
  onAdded,
  onEdited,
}) {
  const isHC = type === 'HC';
  const isEdit = !!parcel;

  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({
    owner_code_id: parcel?.owner_code_id ? String(parcel.owner_code_id) : (parcel?.owner?.id ? String(parcel.owner.id) : ''),
    recipient_name: parcel?.recipient_name || '',
    tracking_number: parcel?.tracking_number || '',
    parcel_type: parcel?.type || 'barang',
    currency: normCurrency(parcel?.currency || feeCurrency),
    estimated_weight_grams: parcel?.estimated_weight_grams?.toString() || '',
    estimated_quantity: parcel?.estimated_quantity?.toString() || '1',
    hc_fee: parcel?.hc_fee?.toString() || '',
    wh_fee: parcel?.wh_fee?.toString() || '',
    additional_fee: parcel?.additional_fee?.toString() || '',
    fine_amount: parcel?.fine_amount ? String(parcel.fine_amount) : '',
    is_manual_input: parcel?.is_manual_input || false,
    need_unboxing: parcel?.need_unboxing || false,
  });
  const [showLabel, setShowLabel] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(parcel?.photo_url || null);
  const [coPhoto, setCoPhoto] = useState(null);
  const [coPreview, setCoPreview] = useState(parcel?.co_photo_url || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/codes').then(r => r.json()).then(setCodes).catch(() => {});
  }, []);

  const feeField = isHC ? 'hc_fee' : 'wh_fee';
  const weight = parseInt(form.estimated_weight_grams) || 0;
  const autoFee = feePerGram > 0 && weight > 0 ? Math.round(weight * feePerGram * 100) / 100 : 0;

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  // Pilih pemilik -> nama penerima ikut terisi kalau masih kosong/sama
  function pickOwner(id) {
    const chosen = codes.find(c => String(c.id) === String(id));
    setForm(f => {
      const prevOwner = codes.find(c => String(c.id) === String(f.owner_code_id));
      const nameIsAuto = !f.recipient_name.trim() || f.recipient_name === prevOwner?.label;
      return {
        ...f,
        owner_code_id: id,
        recipient_name: chosen && nameIsAuto ? chosen.label : f.recipient_name,
      };
    });
  }

  function handleWeightChange(v) {
    setForm(f => {
      const w = parseInt(v) || 0;
      const next = { ...f, estimated_weight_grams: v };
      // isi otomatis biaya kalau tarif per gram sudah diset
      if (feePerGram > 0 && w > 0) {
        next[feeField] = String(Math.round(w * feePerGram * 100) / 100);
      }
      return next;
    });
  }

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

  // Seret-lepas foto: pakai handler yang sama dengan input file
  const dropTo = handler => ({
    onDragOver: e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-matcha-300'); },
    onDragLeave: e => e.currentTarget.classList.remove('ring-2', 'ring-matcha-300'),
    onDrop: e => {
      e.preventDefault();
      e.currentTarget.classList.remove('ring-2', 'ring-matcha-300');
      const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
      if (file) handler({ target: { files: [file] } });
    },
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fd = new FormData();
    if (!isEdit) fd.append('batch_id', batchId);
    fd.append('tracking_number', form.tracking_number);
    fd.append('recipient_name', form.recipient_name);
    fd.append('type', form.parcel_type);
    fd.append('currency', form.currency);
    fd.append('additional_fee', form.additional_fee || '0');
    fd.append('fine_amount', form.fine_amount || '0');
    fd.append('owner_code_id', form.owner_code_id || '');
    fd.append('is_manual_input', form.is_manual_input ? 'true' : 'false');
    fd.append('estimated_weight_grams', form.estimated_weight_grams || '0');
    if (photo) fd.append('photo', photo);
    if (coPhoto) fd.append('co_photo', coPhoto);

    if (isHC) {
      fd.append('estimated_quantity', form.estimated_quantity || '1');
      fd.append('hc_fee', form.hc_fee || '0');
    } else {
      fd.append('wh_fee', form.wh_fee || '0');
      fd.append('need_unboxing', form.need_unboxing ? 'true' : 'false');
    }

    const endpoint = isHC ? 'hc' : 'wh';
    const url = isEdit ? `/api/parcels/${endpoint}/${parcel.id}` : `/api/parcels/${endpoint}`;
    const method = isEdit ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, { method, body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan resi'); return; }
      if (isEdit) onEdited?.(data);
      else onAdded?.(data);
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Judul tetap terlihat walau form digulir */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-matcha-800">
              {isEdit ? '✏️ Edit Resi' : `Tambah Resi ${isHC ? '✈️ Hand Carry' : '🏭 Warehouse'}`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {batchNumber ? `Batch #${batchNumber}` : 'Lengkapi data resi di bawah'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <SectionTitle>Identitas</SectionTitle>

          {/* Pemilik */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pemilik (Kode Akses)
              <span className="text-xs text-gray-400 font-normal ml-1">menentukan siapa yang bisa lihat</span>
            </label>
            <select
              className="input-field"
              value={form.owner_code_id}
              onChange={e => pickOwner(e.target.value)}
            >
              <option value="">— Belum ditentukan —</option>
              {codes.map(c => (
                <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
              ))}
            </select>
            {!form.owner_code_id && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Tanpa pemilik, resi ini tidak muncul di panel pelanggan mana pun
              </p>
            )}
          </div>

          {/* Nama penerima + nomor resi berdampingan */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penerima <span className="text-red-500">*</span></label>
              <input
                className="input-field"
                value={form.recipient_name}
                onChange={e => setField('recipient_name', e.target.value)}
                placeholder="Nama lengkap penerima"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Resi <span className="text-red-500">*</span></label>
              <input
                className="input-field font-mono"
                value={form.tracking_number}
                onChange={e => setField('tracking_number', e.target.value)}
                placeholder="JD1234567890..."
                required
              />
            </div>
          </div>

          {/* Jenis paket */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Paket <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {['barang', 'paperbased'].map(t => (
                <label key={t} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.parcel_type === t ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input type="radio" name="parcel_type" value={t} checked={form.parcel_type === t} onChange={() => setField('parcel_type', t)} className="sr-only" />
                  <span>{t === 'barang' ? '📦' : '📄'}</span>
                  <span className="text-sm font-medium">{t === 'barang' ? 'Barang' : 'Paperbased'}</span>
                </label>
              ))}
            </div>
          </div>

          <SectionTitle>Ukuran &amp; Biaya</SectionTitle>

          {/* Berat + qty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Berat (g)</label>
              <input type="number" min="0" className="input-field" value={form.estimated_weight_grams}
                onChange={e => handleWeightChange(e.target.value)} placeholder="0" />
            </div>
            {isHC ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qty (pcs)</label>
                <input type="number" min="1" className="input-field" value={form.estimated_quantity}
                  onChange={e => setField('estimated_quantity', e.target.value)} placeholder="1" />
              </div>
            ) : <div />}
          </div>

          {/* Mata uang */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mata Uang</label>
            <div className="flex gap-3">
              {Object.entries(CURRENCIES).map(([code, c]) => (
                <label key={code} className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-colors ${form.currency === code ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input type="radio" name="currency" value={code} checked={form.currency === code} onChange={() => setField('currency', code)} className="sr-only" />
                  <span>{c.flag}</span>
                  <span className="text-sm font-medium">{c.symbol} {c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Biaya + additional fee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Biaya {isHC ? 'HC' : 'WH'} ({CURRENCIES[form.currency].symbol})
              </label>
              <input type="number" min="0" step="0.01" className="input-field" value={form[feeField]}
                onChange={e => setField(feeField, e.target.value)} placeholder="0" />
              {autoFee > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Auto:{' '}
                  <button type="button" className="text-matcha-600 underline"
                    onClick={() => setField(feeField, String(autoFee))}>
                    {money(autoFee, form.currency)}
                  </button>
                  <span className="text-gray-300"> ({weight}g × {money(feePerGram, feeCurrency)})</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Fee ({CURRENCIES[form.currency].symbol})
              </label>
              <input type="number" min="0" step="0.01" className="input-field" value={form.additional_fee}
                onChange={e => setField('additional_fee', e.target.value)} placeholder="0" />
            </div>
          </div>

          <SectionTitle>Foto</SectionTitle>

          {/* Foto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📷 Foto Arrival
                <span className="text-xs text-gray-400 font-normal ml-1">(tampil ke user)</span>
              </label>
              {preview && (
                <img src={preview} alt="preview" className="w-full h-24 object-cover rounded-lg mb-1.5 border border-cream-200" />
              )}
              <label {...dropTo(handlePhotoChange)} className="flex items-center justify-center gap-1.5 w-full p-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-matcha-400 text-gray-500 text-xs transition-colors">
                <span>📷</span>
                <span>{preview ? 'Ganti / seret foto' : 'Pilih atau seret foto ke sini'}</span>
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🗂 Foto CO
                <span className="text-xs text-amber-600 font-normal ml-1">(admin only)</span>
              </label>
              {coPreview && (
                <img src={coPreview} alt="co preview" className="w-full h-24 object-cover rounded-lg mb-1.5 border border-amber-200" />
              )}
              <label {...dropTo(handleCoPhotoChange)} className="flex items-center justify-center gap-1.5 w-full p-2.5 border-2 border-dashed border-amber-300 rounded-xl cursor-pointer hover:border-amber-400 text-amber-500 text-xs transition-colors">
                <span>🗂</span>
                <span>{coPreview ? 'Ganti / seret foto CO' : 'Pilih atau seret foto CO'}</span>
                <input type="file" accept="image/*" onChange={handleCoPhotoChange} className="sr-only" />
              </label>
            </div>
          </div>

          <SectionTitle>Penanda &amp; Denda</SectionTitle>

          {/* Video unboxing — khusus WH, biaya dari tarif batch */}
          {!isHC && (
            <label className="flex items-start gap-3 p-3.5 bg-violet-50 rounded-2xl border-2 border-violet-200 cursor-pointer hover:bg-violet-100 transition-colors">
              <input type="checkbox" checked={form.need_unboxing}
                onChange={e => setField('need_unboxing', e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-violet-600" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-violet-800">🎥 Need video unboxing</div>
                <div className="text-xs text-violet-600">
                  Biaya ¥ {Number(unboxingFee).toLocaleString('id-ID')} per resi ikut masuk invoice
                  (tarifnya diatur di Control Tarif)
                </div>
              </div>
            </label>
          )}

          {/* Penanda input manual — cuma tanda, tidak menambah denda */}
          <label className="flex items-start gap-3 p-3.5 bg-amber-50 rounded-2xl border-2 border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
            <input type="checkbox" checked={form.is_manual_input} onChange={e => setField('is_manual_input', e.target.checked)} className="w-4 h-4 accent-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-800">✍️ Tandai sebagai input manual</div>
              <div className="text-xs text-amber-600">
                Sekadar penanda — tidak menambah denda. Muncul sebagai label kuning di daftar resi
                dan sebagai kolom tersendiri saat export CSV.
              </div>
            </div>
          </label>

          {/* Denda — diisi sendiri, tidak otomatis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Denda (Rp)
              <span className="text-xs text-gray-400 font-normal ml-1">opsional, diisi sendiri</span>
            </label>
            <input
              type="number" min="0"
              className="input-field"
              value={form.fine_amount}
              onChange={e => setField('fine_amount', e.target.value)}
              placeholder="0"
            />
            {fineAmount > 0 && String(form.fine_amount) !== String(fineAmount) && (
              <p className="text-xs text-gray-400 mt-1">
                Denda batch ini:{' '}
                <button type="button" className="text-red-500 underline font-medium"
                  onClick={() => setField('fine_amount', String(fineAmount))}>
                  pakai {rupiah(fineAmount)}
                </button>
              </p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Cetak label resi ini — hanya saat mengedit resi yang sudah tersimpan */}
          {isEdit && (
            <button
              type="button"
              onClick={() => setShowLabel(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-matcha-300 text-matcha-700 font-semibold text-sm hover:bg-matcha-50 hover:border-matcha-400 transition-all"
            >
              🏷 Cetak Label Resi Ini
            </button>
          )}

          </div>

          {/* Tombol simpan selalu terlihat, tidak ikut tergulir */}
          <div className="flex gap-2 px-6 py-4 border-t border-cream-200 bg-cream-50 flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary px-6">Batal</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Menyimpan...' : isEdit ? '💾 Simpan Perubahan' : '💾 Simpan Resi'}
            </button>
          </div>
        </form>
      </div>

      {showLabel && (
        <LabelPrintModal
          parcels={[{
            id: parcel.id,
            recipient_name: form.recipient_name,
            tracking_number: form.tracking_number,
          }]}
          batchNumber={batchNumber ?? parcel.batch_id}
          type={type}
          onClose={() => setShowLabel(false)}
        />
      )}
    </div>
  );
}
