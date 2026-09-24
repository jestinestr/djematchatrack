// Dua pemberitahuan soal resi yang diinput manual oleh admin:
//
//  1. Resi manual milik pelanggan ini — pengingat supaya datanya dicek dan
//     terus diperbarui, karena diketik tangan bukan dari setoran resi.
//  2. Resi manual yang belum ada pemiliknya — ditawarkan ke semua pelanggan
//     supaya yang merasa punya segera klaim ke admin.

function ParcelLine({ parcel, index }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/70 border border-white/60">
      <span className="text-[11px] font-black text-gray-400 w-4 text-center flex-shrink-0">{index}</span>
      <span className="font-mono text-xs font-bold text-gray-700 truncate flex-1">
        {parcel.tracking_number}
      </span>
      {parcel.recipient_name && (
        <span className="text-[11px] text-gray-400 truncate max-w-[40%]">{parcel.recipient_name}</span>
      )}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
        parcel.kind === 'hc' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {parcel.kind === 'hc' ? '✈️' : '🏭'}
      </span>
    </div>
  );
}

// ── Resi manual milik sendiri ───────────────────────────────────────
export function ManualMineNotice({ parcels, onOpenParcel }) {
  if (!parcels.length) return null;

  return (
    <div className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">✍️</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-900">
            Hi! {parcels.length === 1 ? 'Resi ini' : `${parcels.length} resi ini`} sudah diinput manual oleh admin
          </p>
          <p className="text-xs text-violet-700/90 mt-0.5 leading-snug">
            Jangan lupa selalu update ya! 💚
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mt-3">
        {parcels.slice(0, 5).map((p, i) => (
          <button key={p.id} onClick={() => onOpenParcel?.(p)}
            className="w-full text-left hover:opacity-80 transition-opacity">
            <ParcelLine parcel={p} index={i + 1} />
          </button>
        ))}
      </div>
      {parcels.length > 5 && (
        <p className="text-[11px] text-violet-600/80 text-center mt-2">
          dan {parcels.length - 5} lagi di daftar bawah
        </p>
      )}
    </div>
  );
}

// ── Resi manual yang belum ada pemiliknya ───────────────────────────
export function UnclaimedNotice({ parcels, onDismiss }) {
  if (!parcels.length) return null;

  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">🫶</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">
            Hello, kalau kamu pemilik resi ini:
          </p>
          <p className="text-xs text-amber-800/90 mt-0.5 leading-snug">
            Ada {parcels.length} resi yang belum ketemu pemiliknya.
          </p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss}
            className="text-[11px] font-bold text-amber-800 bg-white/80 hover:bg-white
                       border border-amber-200 rounded-full px-3 py-1.5 flex-shrink-0 transition-colors">
            Bukan punyaku
          </button>
        )}
      </div>

      <div className="space-y-1.5 mt-3">
        {parcels.map((p, i) => <ParcelLine key={`${p.kind}-${p.id}`} parcel={p} index={i + 1} />)}
      </div>

      <p className="text-xs font-bold text-amber-900 mt-3 leading-snug">
        Pls claim ke admin ya 🙏
      </p>
      <p className="text-[11px] text-amber-700/90 leading-snug">
        Cukup cintamu yang nggak dianggap — barang kamu jangan yaa! 🥹
      </p>
    </div>
  );
}
