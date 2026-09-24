// Sapaan harian di panel pelanggan.
//
// Dua keadaan, dua nada:
//   ada resinya   → "today admin ada update nih, cek yah tsay!"
//   belum ada     → admin memang lagi kerja, tapi resi dia belum kesentuh;
//                   yang penting pelanggan tahu prosesnya jalan, bukan diam.
//
// Kalau hari ini admin memang tidak mengerjakan apa pun, kartunya tidak
// muncul sama sekali — lebih baik sepi daripada basa-basi palsu.
const PREVIEW = 4;

export default function TodayNotice({ adminActive, parcels, onOpenParcel }) {
  if (!adminActive) return null;

  const fresh = parcels.filter(p => p.what === 'baru');
  const photos = parcels.filter(p => p.what === 'foto');

  // ── Belum ada resi dia yang kesentuh hari ini ─────────────────────
  if (!parcels.length) {
    return (
      <div className="rounded-3xl border-2 border-cream-300 bg-cream-50 p-4 flex items-start gap-3">
        <span className="text-2xl leading-none">📦</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-matcha-800">
            Today admin update nih, tapi belum ada resi kamu
          </p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
            Ditunggu ya, begitu masuk langsung nongol di sini! 🤍
          </p>
        </div>
      </div>
    );
  }

  // ── Ada yang baru buat dia ────────────────────────────────────────
  const bagian = [];
  if (fresh.length) bagian.push(`${fresh.length} resi baru masuk`);
  if (photos.length) bagian.push(`${photos.length} foto baru`);

  const shown = parcels.slice(0, PREVIEW);
  const sisa = parcels.length - shown.length;

  return (
    <div className="rounded-3xl border-2 border-matcha-300 bg-gradient-to-br from-matcha-100 to-cream-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">🎉</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-matcha-800">
            Today admin ada update nih, cek yah tsay!
          </p>
          <p className="text-xs text-matcha-700/90 mt-0.5">
            {bagian.join(' · ')} hari ini.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mt-3">
        {shown.map(p => (
          <button
            key={`${p.kind}-${p.id}`}
            onClick={() => onOpenParcel?.(p)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/80
                       hover:bg-white border border-white/70 text-left transition-colors"
          >
            <span className="text-sm">{p.what === 'baru' ? '📦' : '📷'}</span>
            <span className="text-xs font-bold text-gray-700 truncate flex-1">
              {p.recipient_name || '—'}
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              …{String(p.tracking_number || '').slice(-4)}
            </span>
            <span className="text-[10px] font-bold text-matcha-600 whitespace-nowrap">
              {p.what === 'baru' ? 'baru masuk' : 'ada foto'}
            </span>
          </button>
        ))}
        {sisa > 0 && (
          <p className="text-[11px] text-gray-500 text-center pt-0.5">
            dan {sisa} lagi di daftar bawah
          </p>
        )}
      </div>
    </div>
  );
}
