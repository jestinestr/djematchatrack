import { money, rupiah, baseFee, formatWeight } from '../utils/format';

export default function ParcelCard({
  parcel,
  type,
  selectable = false,
  selected = false,
  onSelect,
  onOpen,
}) {
  const isHC = String(type).toUpperCase() === 'HC';
  const masked = !!parcel.masked;
  const fee = baseFee(parcel, type);
  const extra = Number(parcel.additional_fee) || 0;

  function handleClick() {
    if (selectable) onSelect?.();
    else if (!masked) onOpen?.();
  }

  return (
    <div
      onClick={handleClick}
      className={`card flex gap-3 transition-all relative ${
        masked
          ? 'opacity-70 cursor-default'
          : 'cursor-pointer hover:shadow-soft-md hover:border-matcha-200 active:scale-[0.99]'
      } ${selected ? 'border-matcha-500 ring-2 ring-matcha-200' : ''}`}
    >
      {/* Checkbox mode pilih foto */}
      {selectable && (
        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
          selected ? 'bg-matcha-600 border-matcha-600' : 'bg-white border-gray-300'
        }`}>
          {selected && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
      )}

      {/* Foto */}
      <div className="flex-shrink-0">
        {masked ? (
          <div className="w-16 h-16 rounded-lg border border-cream-200 bg-cream-100 flex items-center justify-center text-xl relative overflow-hidden">
            {parcel.has_photo ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-matcha-200 to-cream-300 blur-[6px] scale-110" />
                <span className="relative text-gray-500/70">🔒</span>
              </>
            ) : (
              <span className="text-gray-300">📦</span>
            )}
          </div>
        ) : parcel.photo_url ? (
          <img src={parcel.photo_url} alt="foto" className="w-16 h-16 object-cover rounded-lg border border-cream-200" />
        ) : (
          <div className="w-16 h-16 bg-cream-100 rounded-lg border border-cream-200 flex items-center justify-center text-2xl text-gray-300">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-matcha-800 text-sm leading-tight truncate">
            {parcel.recipient_name}
          </p>
          {!masked && parcel.fine_amount > 0 && (
            <span className="badge-fine flex-shrink-0">⚠️ {rupiah(parcel.fine_amount)}</span>
          )}
        </div>

        <p className="text-xs text-gray-500 font-mono mb-2 truncate" title={masked ? undefined : parcel.tracking_number}>
          {parcel.tracking_number}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <span className="badge-type">
            {parcel.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
          </span>

          {masked ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-400 border border-gray-200">
              🔒 Bukan milikmu
            </span>
          ) : (
            <>
              {parcel.photo_url ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200 font-semibold">
                  📷 Arrived photo
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  ⏳ Not yet
                </span>
              )}
              {parcel.estimated_weight_grams > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                  ⚖️ {formatWeight(parcel.estimated_weight_grams)}
                </span>
              )}
              {isHC && parcel.estimated_quantity > 1 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-100">
                  🔢 {parcel.estimated_quantity} pcs
                </span>
              )}
              {fee > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-100">
                  💰 {money(fee, parcel.currency)}
                </span>
              )}
              {extra > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-100">
                  ➕ {money(extra, parcel.currency)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      {!masked && !selectable && (
        <div className="flex-shrink-0 self-center text-gray-300 text-lg">›</div>
      )}
    </div>
  );
}
