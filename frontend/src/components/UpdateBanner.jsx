import { sinceText } from '../utils/updates';

// Sapaan di atas panel pelanggan: apa saja yang berubah sejak terakhir dia
// buka. Sengaja ringkas — maksimal beberapa resi ditampilkan, sisanya cukup
// dihitung, supaya tidak menutupi isi halaman.
const PREVIEW = 4;

function Row({ parcel, tone, onOpen }) {
  const tail = String(parcel.tracking_number || '').slice(-4);
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/70 hover:bg-white
                 border border-white/60 text-left transition-colors"
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tone}`} />
      <span className="text-xs font-bold text-gray-700 truncate flex-1">
        {parcel.recipient_name || '—'}
      </span>
      <span className="text-[11px] font-mono text-gray-400">…{tail}</span>
      {parcel.photo_url && <span className="text-xs" title="Sudah ada foto">📷</span>}
    </button>
  );
}

export default function UpdateBanner({ name, since, updates, onSeen, onOpenParcel }) {
  const { fresh, photos, total } = updates;
  if (!total) return null;

  const bagian = [];
  if (fresh.length) bagian.push(`${fresh.length} resi baru`);
  if (photos.length) bagian.push(`${photos.length} foto baru`);

  const shown = [...fresh, ...photos].slice(0, PREVIEW);
  const sisa = total - shown.length;

  return (
    <div className="rounded-3xl border-2 border-matcha-200 bg-gradient-to-br from-matcha-50 to-cream-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">👋</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-matcha-800">
            Hai{name ? ` ${name}` : ''}, ada kabar baru!
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {bagian.join(' dan ')} sejak kamu buka {sinceText(since)}.
          </p>
        </div>
        <button
          onClick={onSeen}
          className="text-[11px] font-bold text-matcha-700 bg-white/80 hover:bg-white
                     border border-matcha-200 rounded-full px-3 py-1.5 flex-shrink-0 transition-colors"
        >
          Sudah lihat
        </button>
      </div>

      <div className="space-y-1.5 mt-3">
        {shown.map(p => (
          <Row
            key={p.id}
            parcel={p}
            tone={fresh.includes(p) ? 'bg-matcha-500' : 'bg-amber-400'}
            onOpen={() => onOpenParcel?.(p)}
          />
        ))}
        {sisa > 0 && (
          <p className="text-[11px] text-gray-500 text-center pt-0.5">
            dan {sisa} resi lainnya di daftar bawah
          </p>
        )}
      </div>

      <p className="text-[10px] text-gray-400 mt-2.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-matcha-500" /> resi baru
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> foto baru masuk
        </span>
      </p>
    </div>
  );
}
