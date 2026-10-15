import { useEffect, useMemo, useRef, useState } from 'react';
import { compressImage } from '../utils/image';
import { readCaptureTime } from '../utils/exif';
import PhotoEditor from './PhotoEditor';

// Upload banyak foto sekaligus, dicocokkan ke resi menurut URUTAN BUKA.
//
// Aturannya sederhana dan bisa dicek mata sebelum disimpan:
//   foto diurutkan menurut waktu jepret (bukan waktu upload),
//   resi diurutkan menurut nomor Buka yang sudah ditandai admin,
//   foto ke-n ↔ resi ke-n.
//
// Yang jadi sasaran HANYA resi yang bernomor Buka dan belum punya foto, jadi
// tidak ada foto yang tertimpa. Tidak ada yang tersimpan sebelum admin
// menekan "Simpan" di layar konfirmasi.

const hhmmss = ms =>
  new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const tgl = ms =>
  new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

const SOURCE_LABEL = {
  exif: { text: 'jam jepret', cls: 'text-matcha-700' },
  file: { text: '⚠ jam file, bukan jam jepret', cls: 'text-amber-600' },
  none: { text: '⚠ jam tidak terbaca', cls: 'text-berry-600' },
};

const byName = (a, b) => a.name.localeCompare(b.name, 'id', { numeric: true });

function sortFiles(files, mode) {
  const list = [...files];
  if (mode === 'nama') return list.sort(byName);
  return list.sort((a, b) => {
    if (a.time == null && b.time == null) return byName(a, b);
    if (a.time == null) return 1;
    if (b.time == null) return -1;
    return a.time - b.time || byName(a, b);
  });
}

export default function BulkPhotoUpload({ onClose, onToast, onFinished }) {
  const [targets, setTargets] = useState(null);   // resi bernomor Buka tanpa foto
  const [skipped, setSkipped] = useState(0);      // bernomor Buka tapi sudah ada foto
  const [loadError, setLoadError] = useState('');
  const [files, setFiles] = useState([]);         // { id, file, name, time, source, url }
  const [mode, setMode] = useState('waktu');      // 'waktu' | 'nama'
  const [slots, setSlots] = useState([]);         // id foto per baris, atau null
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState({});       // id foto → 'wait'|'up'|'ok'|'err'
  const [running, setRunning] = useState(false);
  const [editingId, setEditingId] = useState(null); // foto yang sedang dirapikan
  const urls = useRef([]);

  // Resi sasaran: bernomor Buka, urut nomor, foto arrival masih kosong
  useEffect(() => {
    let alive = true;
    fetch('/api/photos/worklist?kind=wh&limit=500')
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        if (d.error) { setLoadError(d.error); setTargets([]); return; }
        const marked = (d.parcels || []).filter(p => p.open_order != null);
        setSkipped(marked.filter(p => p.photo_url).length);
        setTargets(marked.filter(p => !p.photo_url).sort((a, b) => a.open_order - b.open_order));
      })
      .catch(() => { if (alive) { setLoadError('Koneksi gagal'); setTargets([]); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => urls.current.forEach(u => URL.revokeObjectURL(u)), []);

  // Susun ulang pasangan tiap kali foto atau cara mengurutkan berubah
  const byId = useMemo(() => new Map(files.map(f => [f.id, f])), [files]);
  function arrange(list, m) {
    setSlots(sortFiles(list, m).map(f => f.id));
  }

  async function pick(fileList) {
    const picked = [...(fileList || [])].filter(f => f.type.startsWith('image/'));
    if (!picked.length) return;
    setReading(true);
    urls.current.forEach(u => URL.revokeObjectURL(u));
    urls.current = [];
    setStatus({});

    // Waktu jepret dibaca dari file ASLI, sebelum dikecilkan saat upload
    const read = await Promise.all(picked.map(async (file, i) => {
      const t = await readCaptureTime(file);
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: `${i}-${file.name}-${file.size}`, file, name: file.name, url, ...t };
    }));
    setFiles(read);
    arrange(read, mode);
    setReading(false);
  }

  // Hasil editor (putar / ubah rasio) menggantikan file fotonya. Jam jepret
  // dan posisi di urutan tetap dari foto aslinya, karena hasil editor sudah
  // tidak membawa EXIF.
  async function applyEdit(file) {
    const old = byId.get(editingId);
    if (!old) return;
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    URL.revokeObjectURL(old.url);
    urls.current = urls.current.filter(u => u !== old.url);
    setFiles(list => list.map(f => (f.id === editingId ? { ...f, file, url, edited: true } : f)));
    setEditingId(null);
  }

  function changeMode(m) {
    setMode(m);
    arrange(files, m);
  }

  const rows = Math.max(targets?.length || 0, slots.length);
  const swap = (i, j) => setSlots(s => {
    // Foto yang sudah tersimpan tidak ikut digeser
    const locked = k => status[s[k]] === 'ok';
    if (locked(i) || locked(j)) return s;
    const next = [...s];
    while (next.length < rows) next.push(null);
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const drop = i => setSlots(s => s.map((v, k) => (k === i ? null : v)));

  const pairs = Array.from({ length: rows }, (_, i) => ({
    i,
    parcel: targets?.[i] || null,
    photo: byId.get(slots[i]) || null,
  }));
  const ready = pairs.filter(p => p.parcel && p.photo);
  const unmatchedPhotos = pairs.filter(p => p.photo && !p.parcel).length;
  const unmatchedParcels = pairs.filter(p => p.parcel && !p.photo).length;
  const weakTime = files.some(f => f.source !== 'exif');
  const sameTime = new Set(files.map(f => f.time)).size < files.filter(f => f.time != null).length;

  async function save() {
    const todo = ready.filter(p => status[p.photo.id] !== 'ok');
    if (!todo.length) return;
    if (!window.confirm(`Simpan ${todo.length} foto ke resinya masing-masing?`)) return;
    setRunning(true);

    let done = 0;
    for (const p of todo) {       // berurutan, sesuai urutan Buka
      setStatus(s => ({ ...s, [p.photo.id]: 'up' }));
      try {
        const small = await compressImage(p.photo.file);
        const send = () => {
          const fd = new FormData();
          fd.append('photo', small);
          fd.append('kind', p.parcel.kind);
          fd.append('id', p.parcel.id);
          fd.append('slot', 'photo');
          return fetch('/api/photos/upload', { method: 'POST', body: fd });
        };
        let res;
        try { res = await send(); } catch { res = await send(); } // VPN putus — coba sekali lagi
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload gagal');
        setStatus(s => ({ ...s, [p.photo.id]: 'ok' }));
        done++;
      } catch {
        setStatus(s => ({ ...s, [p.photo.id]: 'err' }));
      }
    }
    setRunning(false);
    const failed = todo.length - done;
    onToast?.(failed ? `✅ ${done} tersimpan · ⚠️ ${failed} gagal, coba lagi` : `✅ ${done} foto tersimpan`);
    onFinished?.();
    if (!failed) onClose();
  }

  const doneCount = Object.values(status).filter(v => v === 'ok').length;

  const editor = editingId && byId.get(editingId) ? (
    <PhotoEditor
      url={byId.get(editingId).url}
      title="Atur foto sebelum disimpan"
      onClose={() => setEditingId(null)}
      onSave={applyEdit}
    />
  ) : null;

  return (
    <>
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center"
         onClick={() => !running && onClose()}>
      <div className="bg-cream-100 w-full max-w-2xl max-h-[94vh] rounded-t-[2rem] sm:rounded-3xl
                      flex flex-col overflow-hidden animate-pop-in"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-4 bg-white border-b-2 border-cream-200">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800">Upload banyak sekaligus</p>
            <p className="text-[11px] text-gray-400">
              Foto dicocokkan ke resi menurut urutan Buka · belum tersimpan sebelum kamu menekan Simpan
            </p>
          </div>
          <button onClick={onClose} disabled={running}
            className="w-9 h-9 rounded-full bg-cream-200 text-gray-500 disabled:opacity-40">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {targets === null && (
            <p className="text-sm text-gray-400 text-center py-10 animate-pulse">Memuat urutan Buka…</p>
          )}

          {loadError && (
            <p className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-3 rounded-2xl">{loadError}</p>
          )}

          {targets && targets.length === 0 && !loadError && (
            <div className="bg-white rounded-3xl border-2 border-cream-200 p-8 text-center text-gray-500">
              <div className="text-3xl mb-2">🔖</div>
              <p className="font-bold">Belum ada resi bernomor Buka yang butuh foto</p>
              <p className="text-xs text-gray-400 mt-1">
                Tandai urutan Buka dulu di tabel Warehouse, baru upload fotonya di sini.
                {skipped > 0 && ` (${skipped} resi bernomor Buka sudah punya foto)`}
              </p>
            </div>
          )}

          {targets && targets.length > 0 && (
            <>
              <div className="bg-white rounded-3xl border-2 border-cream-200 p-4">
                <p className="text-sm font-bold text-gray-700">
                  {targets.length} resi menunggu foto
                  <span className="font-normal text-gray-400">
                    {' '}· urutan Buka #{targets[0].open_order} – #{targets[targets.length - 1].open_order}
                  </span>
                </p>
                {skipped > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {skipped} resi bernomor Buka sudah ada fotonya — dilewati, tidak akan ditimpa.
                  </p>
                )}

                <label className={`mt-3 block text-center text-sm font-bold py-3 rounded-2xl cursor-pointer
                                   ${running ? 'opacity-50 pointer-events-none' : ''}
                                   bg-matcha-800 text-white active:translate-y-[1px]`}>
                  <input type="file" accept="image/*" multiple className="hidden"
                         onChange={e => { pick(e.target.files); e.target.value = ''; }} />
                  {files.length ? '🖼️ Ganti pilihan foto' : '🖼️ Pilih semua foto dari galeri'}
                </label>
              </div>

              {reading && (
                <p className="text-sm text-gray-400 text-center animate-pulse">Membaca waktu jepret…</p>
              )}

              {files.length > 0 && !reading && (
                <>
                  {/* Cara mengurutkan */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500">Urutkan foto menurut:</span>
                    {[['waktu', '🕒 Waktu jepret'], ['nama', '🔤 Nama file']].map(([v, l]) => (
                      <button key={v} onClick={() => changeMode(v)} disabled={running}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                          mode === v ? 'bg-matcha-800 text-white' : 'bg-white text-gray-500 border border-cream-300'
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>

                  {mode === 'waktu' && weakTime && (
                    <p className="bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-2.5 rounded-2xl leading-snug">
                      ⚠ {files.filter(f => f.source !== 'exif').length} foto tidak punya jam jepret asli
                      (biasanya karena dikirim lewat WhatsApp). Urutannya mungkin tidak tepat —
                      cek di bawah, atau pindah ke "Nama file".
                    </p>
                  )}
                  {mode === 'waktu' && sameTime && (
                    <p className="bg-amber-50 text-amber-800 text-xs font-semibold px-3 py-2.5 rounded-2xl leading-snug">
                      ⚠ Ada foto dengan jam yang sama persis — urutannya dilanjutkan dari nama file.
                    </p>
                  )}

                  {/* Ringkasan jumlah */}
                  <p className={`text-xs font-bold px-1 ${
                    unmatchedPhotos || unmatchedParcels ? 'text-amber-700' : 'text-matcha-700'
                  }`}>
                    {files.length} foto · {targets.length} resi · {ready.length} pasangan siap
                    {unmatchedPhotos > 0 && ` · ${unmatchedPhotos} foto tanpa resi`}
                    {unmatchedParcels > 0 && ` · ${unmatchedParcels} resi tanpa foto`}
                  </p>

                  {/* Pasangan foto ↔ resi */}
                  <div className="space-y-2">
                    {pairs.map(({ i, parcel, photo }) => {
                      const st = photo ? status[photo.id] : null;
                      const src = photo ? SOURCE_LABEL[photo.source] : null;
                      return (
                        <div key={i}
                             className={`flex items-center gap-2.5 bg-white rounded-2xl border-2 p-2 ${
                               st === 'ok' ? 'border-matcha-400'
                               : st === 'err' ? 'border-berry-400'
                               : 'border-cream-200'
                             }`}>
                          {/* Resi + nomor Buka */}
                          <div className="w-[44%] min-w-0 flex items-center gap-2">
                            {parcel ? (
                              <>
                                <span className="w-7 h-7 rounded-xl bg-matcha-800 text-white text-xs font-black
                                                 flex items-center justify-center flex-shrink-0">
                                  {parcel.open_order}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-800 truncate">{parcel.recipient_name || '—'}</p>
                                  <p className="text-[10px] font-mono text-gray-400 truncate">
                                    …{String(parcel.tracking_number).slice(-4)}
                                    {parcel.owner && <span className="font-sans"> · {parcel.owner.label}</span>}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <p className="text-[11px] text-gray-300 font-semibold">— tidak ada resi —</p>
                            )}
                          </div>

                          <span className="text-gray-300 flex-shrink-0">↔</span>

                          {/* Foto + jam jepret */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            {photo ? (
                              <>
                                <button onClick={() => setEditingId(photo.id)}
                                  disabled={running || st === 'ok'}
                                  title="Putar / ubah rasio foto ini"
                                  className="relative flex-shrink-0 disabled:cursor-default">
                                  <img src={photo.url} alt="" className="w-12 h-12 rounded-xl object-cover
                                                                        border border-cream-200" />
                                  {st !== 'ok' && (
                                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-matcha-800
                                                     text-white text-[10px] flex items-center justify-center">✂️</span>
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-700 truncate">
                                    {photo.time != null ? `${tgl(photo.time)} · ${hhmmss(photo.time)}` : 'jam —'}
                                  </p>
                                  <p className={`text-[10px] font-semibold truncate ${src.cls}`}>{src.text}</p>
                                  <p className="text-[10px] text-gray-300 truncate">
                                    {photo.edited && <span className="text-matcha-700 font-bold">✂️ diedit · </span>}
                                    {photo.name}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <p className="text-[11px] text-gray-300 font-semibold">— kosong —</p>
                            )}
                          </div>

                          {/* Atur manual */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            {st === 'ok' ? <span className="text-matcha-600 font-bold px-2">✓</span>
                              : st === 'up' ? <span className="animate-pulse px-2">⏳</span>
                              : st === 'err' ? <span className="text-berry-600 font-bold text-[10px] px-1">gagal</span>
                              : (
                                <div className="flex gap-0.5">
                                  <button onClick={() => i > 0 && swap(i, i - 1)} disabled={running || i === 0}
                                    title="Naikkan foto ini"
                                    className="w-7 h-7 rounded-lg bg-cream-100 text-gray-600 text-xs disabled:opacity-30">↑</button>
                                  <button onClick={() => i < rows - 1 && swap(i, i + 1)} disabled={running || i === rows - 1}
                                    title="Turunkan foto ini"
                                    className="w-7 h-7 rounded-lg bg-cream-100 text-gray-600 text-xs disabled:opacity-30">↓</button>
                                  <button onClick={() => drop(i)} disabled={running || !photo}
                                    title="Jangan pakai foto ini"
                                    className="w-7 h-7 rounded-lg bg-berry-50 text-berry-600 text-xs disabled:opacity-30">✕</button>
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {files.length > 0 && targets?.length > 0 && !reading && (
          <div className="p-4 bg-white border-t-2 border-cream-200">
            <button onClick={save} disabled={running || !ready.length || ready.every(p => status[p.photo.id] === 'ok')}
              className="w-full py-3.5 rounded-2xl bg-matcha-800 text-white font-bold text-sm
                         disabled:opacity-50 active:translate-y-[1px]">
              {running
                ? `⏳ Menyimpan… ${doneCount}/${ready.length}`
                : Object.values(status).includes('err')
                  ? '↻ Coba lagi yang gagal'
                  : `Simpan ${ready.length} foto`}
            </button>
          </div>
        )}
      </div>
    </div>
    {editor}
    </>
  );
}
