import { useState } from 'react';
import ParcelDetailModal from './ParcelDetailModal';

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export default function ParcelCard({ parcel, type }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <div
        className="card flex gap-3 cursor-pointer hover:shadow-soft-md hover:border-matcha-200 transition-all active:scale-[0.99]"
        onClick={() => setShowDetail(true)}
      >
        {/* Photo */}
        <div className="flex-shrink-0">
          {parcel.photo_url ? (
            <img
              src={parcel.photo_url}
              alt="foto"
              className="w-16 h-16 object-cover rounded-lg border border-cream-200"
            />
          ) : (
            <div className="w-16 h-16 bg-cream-100 rounded-lg border border-cream-200 flex items-center justify-center text-2xl text-gray-300">
              📦
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-matcha-800 text-sm leading-tight truncate">
              {parcel.recipient_name}
            </p>
            {parcel.fine_amount > 0 && (
              <span className="badge-fine flex-shrink-0">⚠️ Denda {formatRupiah(parcel.fine_amount)}</span>
            )}
          </div>

          <p className="text-xs text-gray-500 font-mono mb-2 truncate" title={parcel.tracking_number}>
            {parcel.tracking_number}
          </p>

          <div className="flex flex-wrap gap-1.5">
            <span className="badge-type">
              {parcel.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
            </span>
            {type === 'hc' && parcel.estimated_weight_grams > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                ⚖️ {parcel.estimated_weight_grams}g
              </span>
            )}
            {type === 'hc' && parcel.estimated_quantity > 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-100">
                🔢 {parcel.estimated_quantity} pcs
              </span>
            )}
            {type === 'wh' && parcel.wh_fee > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-100">
                💰 {formatRupiah(parcel.wh_fee)}
              </span>
            )}
          </div>
        </div>

        {/* Chevron hint */}
        <div className="flex-shrink-0 self-center text-gray-300 text-lg">›</div>
      </div>

      {showDetail && (
        <ParcelDetailModal
          parcel={parcel}
          type={type}
          isAdmin={false}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
