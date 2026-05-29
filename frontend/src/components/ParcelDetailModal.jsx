import { useState } from 'react';

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
function formatDate(str) {
  if (!str) return '-';
  return new Date(str).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// isAdmin: if true, show CO photo too
export default function ParcelDetailModal({ parcel, type, isAdmin = false, onClose }) {
  const [zoomUrl, setZoomUrl] = useState(null);

  if (!parcel) return null;
  const isHC = (type || '').toUpperCase() === 'HC';

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-soft-lg w-full max-w-sm overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Photos */}
          <div className={`grid ${isAdmin && parcel.co_photo_url ? 'grid-cols-2' : 'grid-cols-1'} gap-0`}>
            {/* Arrival photo */}
            <div className="relative bg-cream-100">
              {parcel.photo_url ? (
                <img
                  src={parcel.photo_url}
                  alt="arrival"
                  onClick={() => setZoomUrl(parcel.photo_url)}
                  className="w-full h-52 object-cover cursor-zoom-in"
                />
              ) : (
                <div className="w-full h-52 flex items-center justify-center text-5xl text-gray-200">📦</div>
              )}
              <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-white/80 text-gray-600 px-2 py-0.5 rounded-full">
                📷 Arrival
              </span>
            </div>

            {/* CO photo — admin only */}
            {isAdmin && parcel.co_photo_url && (
              <div className="relative bg-amber-50">
                <img
                  src={parcel.co_photo_url}
                  alt="CO"
                  onClick={() => setZoomUrl(parcel.co_photo_url)}
                  className="w-full h-52 object-cover cursor-zoom-in"
                />
                <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">
                  🗂 CO
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Name + close */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="text-lg font-bold text-matcha-800 leading-tight">{parcel.recipient_name}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">×</button>
            </div>

            {/* Tracking number */}
            <p className="text-sm font-mono text-gray-400 mb-4 break-all">{parcel.tracking_number}</p>

            {/* Detail rows */}
            <div className="space-y-2.5">
              <DetailRow icon="📦" label="Jenis">
                {parcel.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
              </DetailRow>

              {isHC && parcel.estimated_weight_grams > 0 && (
                <DetailRow icon="⚖️" label="Estimasi Berat">
                  {parcel.estimated_weight_grams} gram
                </DetailRow>
              )}
              {isHC && parcel.estimated_quantity > 0 && (
                <DetailRow icon="🔢" label="Qty">
                  {parcel.estimated_quantity} pcs
                </DetailRow>
              )}
              {!isHC && parcel.wh_fee > 0 && (
                <DetailRow icon="💰" label="WH Fee">
                  <span className="text-amber-700 font-semibold">{formatRupiah(parcel.wh_fee)}</span>
                </DetailRow>
              )}
              {parcel.fine_amount > 0 && (
                <DetailRow icon="⚠️" label="Denda">
                  <span className="text-red-600 font-semibold">{formatRupiah(parcel.fine_amount)}</span>
                </DetailRow>
              )}
              {parcel.created_at && (
                <DetailRow icon="🕐" label="Ditambahkan">
                  {formatDate(parcel.created_at)}
                </DetailRow>
              )}
            </div>

            <button onClick={onClose} className="btn-primary w-full mt-5 py-2.5">Tutup</button>
          </div>
        </div>
      </div>

      {/* Zoom overlay */}
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
