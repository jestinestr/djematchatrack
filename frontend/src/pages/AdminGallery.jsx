import { useEffect, useState, useMemo, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { slugify, downloadImage, cardName, makePhotoCard } from '../utils/format';


// Foto utama + foto tambahan (album) satu resi
const photosOf = p => [p.photo_url, ...(p.extra_photos || [])].filter(Boolean);
const fileName = (p, i) =>
  `${slugify(cardName(p))}_${slugify(p.tracking_number)}${i ? `_${i + 1}` : ''}`;

export default function AdminGallery() {
  const [whBatches, setWhBatches] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [batchFilter, setBatchFilter] = useState('active'); // 'active'|batch_id
  const [ownerFilter, setOwnerFilter] = useState('all');    // 'all'|owner id
  const [order, setOrder] = useState('new');                // 'new'|'old'
  const [selected, setSelected]   = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  const [preview, setPreview] = useState(null);   // { parcel, index, url, error } — pratinjau hasil unduhan
  const previewSeq = useRef(0);                 // hanya hasil terbaru yang dipakai
  const swipeX = useRef(null);

  useEffect(() => {
    fetch('/api/parcels/wh/all')
      .then(r => r.json())
      .then(wh => {
        setWhBatches(wh);
        setLoading(false);
      });
  }, []);

  // Semua resi beserta batchnya
  const allParcels = useMemo(
    () => whBatches.flatMap(b => (b.parcels || []).map(p => ({ ...p, _type: 'WH', _batch: b }))),
    [whBatches]
  );

  const allBatches = useMemo(
    () => [...whBatches].sort((a, b) => b.batch_number - a.batch_number),
    [whBatches]
  );

  // Filtered parcels (only with photos)
  // Pelanggan yang punya foto, untuk saringan per user
  const owners = useMemo(() => {
    const map = new Map();
    for (const p of allParcels) {
      if (p.photo_url && p.owner && !map.has(String(p.owner.id))) map.set(String(p.owner.id), p.owner);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }, [allParcels]);

  // Hanya yang ada foto, terbaru di atas
  // Patokan "baru" adalah kapan fotonya diupload, bukan kapan resinya
  // dibuat — yang dicari admin memang foto yang barusan masuk.
  const waktuFoto = p => new Date(p.photo_uploaded_at || p.created_at || 0).getTime();

  const parcels = useMemo(() => {
    const hasil = allParcels.filter(p => {
      if (!p.photo_url) return false;
      if (ownerFilter !== 'all' && String(p.owner?.id) !== ownerFilter) return false;
      if (batchFilter === 'active') return p._batch.status === 'active';
      if (batchFilter !== 'all') return String(p._batch.id) === String(batchFilter);
      return true;
    });

    if (order === 'az') {
      return hasil.sort((a, b) =>
        String(a.owner?.label || 'zzz').localeCompare(String(b.owner?.label || 'zzz'), 'id') ||
        waktuFoto(b) - waktuFoto(a));
    }
    return hasil.sort((a, b) =>
      order === 'old' ? waktuFoto(a) - waktuFoto(b) : waktuFoto(b) - waktuFoto(a));
  }, [allParcels, batchFilter, ownerFilter, order]);

  // Foto yang diupload hari ini — ditandai garis hijau, dan ditampilkan
  // lagi di barisan atas apa pun urutan yang sedang dipakai.
  const barusan = useMemo(() => {
    const pagi = new Date();
    pagi.setHours(0, 0, 0, 0);
    return parcels
      .filter(p => p.photo_uploaded_at && new Date(p.photo_uploaded_at) >= pagi)
      .sort((a, b) => waktuFoto(b) - waktuFoto(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels]);

  const baruHariIni = useMemo(
    () => new Set(barusan.map(p => p.id)),
    [barusan]
  );

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === parcels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(parcels.map(p => p.id)));
    }
  }

  async function handleDownload() {
    const targets = parcels.filter(p => selected.has(p.id));
    if (!targets.length) return;
    setDownloading(true);
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      const fotos = photosOf(p);
      for (let k = 0; k < fotos.length; k++) {
        await downloadImage(fotos[k], fileName(p, k),
          { name: cardName(p), tracking: p.tracking_number, part: k ? k + 1 : null });
        if (k < fotos.length - 1) await new Promise(r => setTimeout(r, 400));
      }
      // Catat supaya tidak terunduh dua kali tanpa sengaja
      fetch('/api/photos/downloaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: p._type.toLowerCase(), ids: [p.id] }),
      }).then(() => setDownloadedIds(prev => new Set(prev).add(p.id))).catch(() => {});
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    setDownloading(false);
  }

  // Pratinjau memakai penyusun gambar yang sama dengan tombol Download,
  // jadi yang dilihat admin persis file yang nanti terunduh.
  async function showPreview(p, index = 0) {
    const seq = ++previewSeq.current;
    setPreview(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { parcel: p, index, url: null, error: '' };
    });
    try {
      const blob = await makePhotoCard(
        photosOf(p)[index], cardName(p), p.tracking_number, index ? index + 1 : null);
      if (seq !== previewSeq.current) return; // sudah pindah foto lagi
      setPreview({ parcel: p, index, url: URL.createObjectURL(blob), error: '' });
    } catch {
      if (seq !== previewSeq.current) return;
      setPreview({ parcel: p, index, url: null, error: 'Pratinjau gagal dibuat' });
    }
  }

  // Geser antar foto album (kiri/kanan, berputar)
  function stepPreview(dir) {
    if (!preview) return;
    const total = photosOf(preview.parcel).length;
    if (total < 2) return;
    showPreview(preview.parcel, (preview.index + dir + total) % total);
  }

  function closePreview() {
    previewSeq.current++;
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  // Panah kiri/kanan di keyboard, Esc menutup
  useEffect(() => {
    if (!preview) return;
    const onKey = e => {
      if (e.key === 'ArrowLeft') stepPreview(-1);
      else if (e.key === 'ArrowRight') stepPreview(1);
      else if (e.key === 'Escape') closePreview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allSelected = parcels.length > 0 && selected.size === parcels.length;
  const someSelected = selected.size > 0;

  return (
    <div className="p-5 md:p-7">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">📸</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Recap Foto</h1>
          <p className="text-sm text-gray-500">Galeri foto arrival untuk cek koper</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Batch filter */}
        <select
          value={batchFilter}
          onChange={e => { setBatchFilter(e.target.value); setSelected(new Set()); }}
          className="input-field text-sm w-auto py-1.5"
        >
          <option value="active">Batch Aktif</option>
          <option value="all">Semua Batch</option>
          {allBatches.map(b => (
            <option key={b.id} value={b.id}>
              Batch #{b.batch_number} ({b.type}) {b.status === 'active' ? '● Aktif' : '✓ Selesai'}
            </option>
          ))}
        </select>

        {/* Saringan per pelanggan */}
        <select
          value={ownerFilter}
          onChange={e => { setOwnerFilter(e.target.value); setSelected(new Set()); }}
          className="input-field text-sm w-auto py-1.5"
        >
          <option value="all">👤 Semua pelanggan</option>
          {owners.map(o => (
            <option key={o.id} value={String(o.id)}>{o.label}</option>
          ))}
        </select>

        {/* Urutan */}
        <div className="flex gap-1 bg-white border border-cream-200 rounded-xl p-1">
          {[['new', '↓ Terbaru'], ['old', '↑ Terlama'], ['az', 'A–Z pelanggan']].map(([v, l]) => (
            <button key={v} onClick={() => setOrder(v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                order === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
              }`}>
              {l}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Select all + download */}
        {parcels.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-xl border border-cream-300 bg-white text-gray-600 hover:bg-cream-50 font-medium transition-colors">
              {allSelected ? 'Batal Semua' : ownerFilter !== 'all' ? `Pilih Semua milik ${owners.find(o => String(o.id) === ownerFilter)?.label || ''}` : 'Pilih Semua'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!someSelected || downloading}
              className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl font-semibold transition-all ${
                someSelected
                  ? 'bg-matcha-800 hover:bg-matcha-700 text-white shadow-soft'
                  : 'bg-cream-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {downloading ? (
                <><span className="animate-spin">⏳</span> Downloading...</>
              ) : (
                <><span>⬇️</span> Download {someSelected ? `(${selected.size})` : ''}</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Gallery */}
      {loading ? (
        <LoadingSpinner text="Memuat foto..." />
      ) : parcels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-16 text-center text-gray-400">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="font-medium">Belum ada foto arrival</p>
          <p className="text-sm mt-1">Foto akan muncul di sini setelah admin upload</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {parcels.length} foto ditemukan{someSelected ? `, ${selected.size} dipilih` : ''}
            {barusan.length > 0 && (
              <span className="text-green-600 font-semibold"> · {barusan.length} baru hari ini</span>
            )}
          </p>

          {/* Yang barusan diupload selalu ikut tampil di atas, apa pun
              urutan yang dipilih — biasanya itu yang sedang dicek */}
          {barusan.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-2">
                Baru diupload hari ini ({barusan.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {barusan.slice(0, 16).map(p => (
                  <button key={`baru-${p.id}`} onClick={() => toggleSelect(p.id)}
                    title={`${p.owner?.label || '—'} · ${p.tracking_number}`}
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                      selected.has(p.id) ? 'border-matcha-600' : 'border-green-400 hover:border-green-500'
                    }`}>
                    <img src={p.photo_url} alt="" loading="lazy"
                      className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {parcels.map(p => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-matcha-500 shadow-soft-md scale-[0.98]'
                      : baruHariIni.has(p.id)
                        ? 'border-green-400 hover:border-green-500 hover:shadow-soft'
                        : 'border-transparent hover:border-matcha-300 hover:shadow-soft'
                  }`}
                  title={baruHariIni.has(p.id) ? 'Diupload hari ini' : undefined}
                >
                  {/* Photo */}
                  <div className="aspect-square bg-cream-100 relative overflow-hidden">
                    <img
                      src={p.photo_url}
                      alt={p.recipient_name}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay on hover/selected */}
                    <div className={`absolute inset-0 transition-opacity duration-150 ${isSelected ? 'bg-matcha-800/20' : 'bg-black/0 group-hover:bg-black/5'}`} />
                    {/* Checkbox */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-matcha-600 border-matcha-600' : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
                    }`}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    {/* Sudah pernah diunduh */}
                    {(p.photo_dl_admin || downloadedIds.has(p.id)) && (
                      <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                        ✓ Downloaded
                      </span>
                    )}

                    {/* Lihat hasil unduhannya */}
                    <button
                      onClick={e => { e.stopPropagation(); showPreview(p); }}
                      title="Lihat seperti hasil unduhan"
                      className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/90 text-gray-600
                                 flex items-center justify-center text-xs shadow-soft
                                 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      👁
                    </button>

                    {/* Jumlah foto dalam album */}
                    {photosOf(p).length > 1 && (
                      <span className="absolute top-8 left-2 text-[10px] font-bold bg-matcha-800 text-white px-1.5 py-0.5 rounded-full">
                        📷 {photosOf(p).length}
                      </span>
                    )}

                    {/* Type badge */}
                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      p._type === 'HC' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p._type === 'HC' ? '✈️' : '🏭'} #{p._batch.batch_number}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="bg-white px-2.5 py-2">
                    <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{p.recipient_name}</p>
                    <p className="text-[10px] font-mono text-gray-400 truncate mt-0.5">{p.tracking_number}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pratinjau hasil unduhan */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
             onClick={closePreview}>
          <div onClick={e => e.stopPropagation()}
               className="bg-white rounded-3xl overflow-hidden max-w-md w-full max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-cream-200">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-gray-800 truncate">{cardName(preview.parcel)}</p>
                <p className="text-[11px] font-mono text-gray-400 truncate">{preview.parcel.tracking_number}</p>
              </div>
              <button onClick={closePreview}
                className="w-8 h-8 rounded-full bg-cream-200 text-gray-500 flex items-center justify-center">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-cream-100 relative"
                 onTouchStart={e => { swipeX.current = e.touches[0].clientX; }}
                 onTouchEnd={e => {
                   if (swipeX.current == null) return;
                   const dx = e.changedTouches[0].clientX - swipeX.current;
                   swipeX.current = null;
                   if (Math.abs(dx) > 50) stepPreview(dx < 0 ? 1 : -1);
                 }}>
              {preview.error ? (
                <p className="text-sm text-red-600 text-center py-10">{preview.error}</p>
              ) : preview.url ? (
                <img src={preview.url} alt="" className="w-full rounded-xl shadow-soft" />
              ) : (
                <p className="text-sm text-gray-400 text-center py-10 animate-pulse">Menyiapkan pratinjau…</p>
              )}

              {photosOf(preview.parcel).length > 1 && (
                <>
                  <button onClick={() => stepPreview(-1)} aria-label="Foto sebelumnya"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90
                               shadow-soft text-gray-700 text-lg flex items-center justify-center">‹</button>
                  <button onClick={() => stepPreview(1)} aria-label="Foto berikutnya"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90
                               shadow-soft text-gray-700 text-lg flex items-center justify-center">›</button>
                </>
              )}
            </div>

            {photosOf(preview.parcel).length > 1 && (
              <div className="flex items-center justify-center gap-1.5 py-2 border-t border-cream-200">
                {photosOf(preview.parcel).map((_, i) => (
                  <button key={i} onClick={() => showPreview(preview.parcel, i)}
                    aria-label={`Foto ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === preview.index ? 'w-5 bg-matcha-700' : 'w-2 bg-cream-300'
                    }`} />
                ))}
                <span className="ml-2 text-[11px] font-semibold text-gray-500">
                  {preview.index + 1} / {photosOf(preview.parcel).length}
                </span>
              </div>
            )}

            <div className="p-4 border-t border-cream-200 space-y-2">
              <button
                onClick={() => {
                  const p = preview.parcel, i = preview.index;
                  downloadImage(photosOf(p)[i], fileName(p, i),
                    { name: cardName(p), tracking: p.tracking_number, part: i ? i + 1 : null });
                }}
                disabled={!preview.url}
                className="btn-primary w-full py-2.5 disabled:opacity-50"
              >
                ⬇️ Download foto ini
              </button>
              {photosOf(preview.parcel).length > 1 && (
                <button
                  onClick={async () => {
                    const p = preview.parcel;
                    const fotos = photosOf(p);
                    for (let k = 0; k < fotos.length; k++) {
                      await downloadImage(fotos[k], fileName(p, k),
                        { name: cardName(p), tracking: p.tracking_number, part: k ? k + 1 : null });
                      if (k < fotos.length - 1) await new Promise(r => setTimeout(r, 400));
                    }
                  }}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl border border-cream-300
                             bg-white text-matcha-800 hover:bg-cream-50"
                >
                  ⬇️ Download semua ({photosOf(preview.parcel).length} foto)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
