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

// ── Pengumuman tarif resi input manual ─────────────────────────────
//
// Teksnya ditulis admin di Control Tarif, jadi isinya bisa berubah tanpa
// ganti kode. Kartunya hilang sendiri kalau pengumumannya dikosongkan
// atau dendanya dimatikan. Pelanggan bisa menutupnya; kalau admin
// mengubah teksnya, kartunya muncul lagi.
export function FineNotice({ info, onDismiss }) {
  if (!info?.manual_fine_on || !info.manual_fine_notice?.trim()) return null;

  return (
    <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">📣</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">Pemberitahuan dari admin</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed whitespace-pre-line">
            {info.manual_fine_notice}
          </p>
          <p className="text-[11px] text-amber-700/80 mt-2 leading-snug">
            Supaya tidak kena tarif ini, setor resimu lewat tombol
            <b> Setor Resi</b> sebelum barangnya sampai ke admin ya 💚
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-700 text-lg leading-none flex-shrink-0"
            title="Sudah paham, sembunyikan"
          >
            ✕
          </button>
        )}
      </div>
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

// ── Resi yang fotonya lebih dari satu (album) ───────────────────────
//  Pesannya dari admin: foto dipecah karena satu foto tidak cukup memuat
//  semua isinya. parcels: resi milik pelanggan dengan extra_photos terisi.
export function AlbumNotice({ parcels, onOpenParcel }) {
  const list = (parcels || []).filter(p => (p.extra_photos || []).length > 0);
  if (!list.length) return null;

  return (
    <div className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">📷</span>
        <p className="text-sm font-bold text-sky-900 leading-snug">Hi ka!</p>
      </div>

      <div className="space-y-1.5 mt-3">
        {list.slice(0, 5).map(p => (
          <button key={`${p.kind || ''}-${p.id}`} onClick={() => onOpenParcel?.(p)}
            className="w-full text-left px-3 py-2 rounded-xl bg-white/70 border border-white/60
                       hover:opacity-80 transition-opacity">
            <p className="text-xs text-sky-900 leading-snug">
              Resi <span className="font-mono font-bold">{p.tracking_number}</span>
              {p.recipient_name ? <span className="text-sky-700/80"> ({p.recipient_name})</span> : null}
              {' '}ada <span className="font-bold">{1 + p.extra_photos.length} foto</span> ya
            </p>
          </button>
        ))}
      </div>
      {list.length > 5 && (
        <p className="text-[11px] text-sky-700/80 text-center mt-2">
          dan {list.length - 5} resi lagi di daftar bawah
        </p>
      )}

      <p className="text-xs text-sky-800/90 mt-3 leading-snug">
        Maaf karena ga cukup space nya 🙏
      </p>
    </div>
  );
}
