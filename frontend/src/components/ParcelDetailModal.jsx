import { useState } from 'react';
import { money, rupiah, baseFee, formatWeight, formatDate, cardName, tail4, downloadImage, slugify } from '../utils/format';

// isAdmin: kalau true, foto CO ikut ditampilkan
// siblings: resi lain milik pengguna di batch yang sama
export default function ParcelDetailModal({
  parcel,
  type,
  isAdmin = false,
  siblings = [],
  onSelectSibling,
  onClose,
}) {
  const [zoomUrl, setZoomUrl] = useState(null);

  if (!parcel) return null;
  const isHC = (type || '').toUpperCase() === 'HC';
  const fee = baseFee(parcel, type);
  const extra = Number(parcel.additional_fee) || 0;
  const rest = (siblings || []).filter(p => p.id !== parcel.id);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-soft-lg w-full max-w-md overflow-y-auto max-h-[90vh] animate-pop-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Foto */}
          <div className={`grid ${isAdmin && parcel.co_photo_url ? 'grid-cols-2' : 'grid-cols-1'} gap-0 flex-shrink-0`}>
            <div className="relative bg-cream-100">
              {parcel.photo_url ? (
                <img
                  src={parcel.photo_url}
                  alt="arrival"
                  onClick={() => setZoomUrl(parcel.photo_url)}
                  className="w-full aspect-square object-cover cursor-zoom-in"
                />
              ) : (
                <div className="w-full h-52 flex items-center justify-center text-5xl text-gray-200">📦</div>
              )}
              <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-white/80 text-gray-600 px-2 py-0.5 rounded-full">
                📷 Arrival
              </span>
            </div>

            {/* Foto CO — admin only */}
            {isAdmin && parcel.co_photo_url && (
              <div className="relative bg-amber-50">
                <img
                  src={parcel.co_photo_url}
                  alt="CO"
                  onClick={() => setZoomUrl(parcel.co_photo_url)}
                  className="w-full aspect-square object-cover cursor-zoom-in"
                />
                <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">
                  🗂 CO
                </span>
              </div>
            )}
          </div>

          {/* Keterangan ala kartu foto: nama kiri, 4 digit resi kanan */}
          {parcel.photo_url && (
            <div className="flex items-end justify-between gap-3 px-5 pt-3 pb-1">
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate leading-tight">{cardName(parcel)}</p>
                <button
                  onClick={() => downloadImage(
                    parcel.photo_url,
                    `${slugify(cardName(parcel))}_${slugify(parcel.tracking_number)}`,
                    { name: cardName(parcel), tracking: parcel.tracking_number },
                  )}
                  className="text-xs font-semibold text-matcha-600 hover:underline mt-0.5"
                >
                  ⬇️ Download foto
                </button>
              </div>
              <p className="text-4xl font-black text-gray-900 leading-none tracking-tight">
                {tail4(parcel.tracking_number)}
              </p>
            </div>
          )}

          {/* Isi */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-lg font-bold text-matcha-800 leading-tight">{parcel.recipient_name}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
            </div>

            <p className="text-sm font-mono text-gray-400 mb-4 break-all">{parcel.tracking_number}</p>

            <div className="space-y-2.5">
              <DetailRow icon="📦" label="Jenis">
                {parcel.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
              </DetailRow>

              {isAdmin && parcel.owner && (
                <DetailRow icon="👤" label="Pemilik">
                  {parcel.owner.label}
                  <span className="text-gray-400 font-mono text-xs ml-1.5">{parcel.owner.code}</span>
                </DetailRow>
              )}

              {parcel.estimated_weight_grams > 0 && (
                <DetailRow icon="⚖️" label="Estimasi Berat">
                  {formatWeight(parcel.estimated_weight_grams)}
                </DetailRow>
              )}
              {isHC && parcel.estimated_quantity > 0 && (
                <DetailRow icon="🔢" label="Qty">
                  {parcel.estimated_quantity} pcs
                </DetailRow>
              )}
              {fee > 0 && (
                <DetailRow icon="💰" label={isHC ? 'Biaya HC' : 'Biaya WH'}>
                  <span className="text-amber-700 font-semibold">{money(fee, parcel.currency)}</span>
                </DetailRow>
              )}
              {extra > 0 && (
                <DetailRow icon="➕" label="Additional Fee">
                  <span className="text-orange-600 font-semibold">{money(extra, parcel.currency)}</span>
                </DetailRow>
              )}
              {parcel.fine_amount > 0 && (
                <DetailRow icon="⚠️" label="Denda">
                  <span className="text-red-600 font-semibold">{rupiah(parcel.fine_amount)}</span>
                </DetailRow>
              )}
              {(fee > 0 || extra > 0) && (
                <div className="flex items-center justify-between gap-2 pt-2.5 mt-1 border-t-2 border-dashed border-cream-200">
                  <span className="text-xs font-bold text-matcha-700">Total</span>
                  <span className="text-sm font-black text-matcha-800">
                    {money(fee + extra, parcel.currency)}
                    {parcel.fine_amount > 0 && (
                      <span className="text-xs text-red-500 font-semibold"> + {rupiah(parcel.fine_amount)}</span>
                    )}
                  </span>
                </div>
              )}
              {parcel.created_at && (
                <DetailRow icon="🕐" label="Ditambahkan">
                  {formatDate(parcel.created_at)}
                </DetailRow>
              )}
            </div>

            {/* Resi lain di batch yang sama */}
            {rest.length > 0 && (
              <div className="mt-5 pt-4 border-t border-cream-200">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Resi lain di batch ini ({rest.length})
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto -mx-1 px-1">
                  {rest.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSelectSibling?.(p)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-cream-200 hover:border-matcha-300 hover:bg-matcha-50 transition-all text-left"
                    >
                      {p.photo_url ? (
                        <img src={p.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-cream-200 flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-cream-100 border border-cream-200 flex items-center justify-center text-sm flex-shrink-0">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{p.recipient_name}</p>
                        <p className="text-[11px] font-mono text-gray-400 truncate">{p.tracking_number}</p>
                      </div>
                      <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={onClose} className="btn-primary w-full mt-5 py-2.5">Tutup</button>
          </div>
        </div>
      </div>

      {zoomUrl && (
        <div className="photo-zoom-overlay" style={{ zIndex: 60 }} onClick={() => setZoomUrl(null)}>
          <img src={zoomUrl} alt="zoom" className="max-w-[92vw] max-h-[92vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}
    </>
  );
}

function DetailRow({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400 flex items-center gap-1.5">
        <span>{icon}</span>{label}
      </span>
      <span className="text-sm text-gray-700 font-medium text-right">{children}</span>
    </div>
  );
}
