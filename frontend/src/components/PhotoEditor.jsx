import { useCallback, useEffect, useRef, useState } from 'react';

// Perapi foto arrival: pilih bentuk bingkai, geser, perbesar/perkecil, putar,
// lalu simpan ulang.
//
// Dipakai untuk kasus sehari-hari "kurang ke tengah" atau "kurang ke kanan" —
// fotonya sudah bagus, cuma resinya tidak pas di bingkai. Daripada memotret
// ulang paketnya yang mungkin sudah dibuka, posisinya tinggal digeser.
//
// Zoom boleh turun sampai 0,5× supaya seluruh isi foto muat; sisa bingkai
// yang kosong diisi warna latar, bukan dipaksa penuh.
const OUT = 1400;          // sisi terpanjang gambar hasil (px)
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

// ratio = tinggi bingkai dibanding lebarnya
const SHAPES = [
  { key: '1:1', label: '1 : 1', ratio: 1 },
  { key: '4:3', label: '4 : 3', ratio: 3 / 4 },
  { key: '3:4', label: '3 : 4', ratio: 4 / 3 },
];

// Ukuran gambar setelah diputar 90°/270° (sisinya bertukar)
const rotatedSize = (img, deg) =>
  (deg % 180 === 0 ? { w: img.naturalWidth, h: img.naturalHeight }
                   : { w: img.naturalHeight, h: img.naturalWidth });

// Semua ukuran dihitung dalam satuan "kali lebar bingkai", jadi rumus yang
// sama dipakai untuk pratinjau di layar maupun gambar hasil.
// Pada zoom 1 foto pas menutup bingkai (seperti object-fit: cover).
const coverScale = (img, deg, zoom, ratio) => {
  const { w, h } = rotatedSize(img, deg);
  return Math.max(1 / w, ratio / h) * zoom;
};

// Batas geser: selama foto lebih besar dari bingkai, pinggirnya tidak boleh
// sampai bolong. Begitu fotonya lebih kecil (zoom < 1), justru dijaga supaya
// tidak keluar bingkai.
function clampOffset(img, deg, zoom, ratio, dx, dy) {
  const { w, h } = rotatedSize(img, deg);
  const scale = coverScale(img, deg, zoom, ratio);
  const limit = (size, frame) => Math.abs(size * scale - frame) / 2;
  const limitX = limit(w, 1);
  const limitY = limit(h, ratio);
  return {
    dx: Math.max(-limitX, Math.min(limitX, dx)),
    dy: Math.max(-limitY, Math.min(limitY, dy)),
  };
}

export default function PhotoEditor({ url, title = 'Atur Foto', onSave, onClose }) {
  const [img, setImg] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [shape, setShape] = useState(SHAPES[0]);
  const [zoom, setZoom] = useState(1);
  const [deg, setDeg] = useState(0);
  const [off, setOff] = useState({ dx: 0, dy: 0 });   // dalam satuan "kali lebar bingkai"
  const frameRef = useRef(null);
  const drag = useRef(null);

  // crossOrigin wajib, kalau tidak canvas-nya "ternoda" dan tidak bisa disimpan
  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImg(image);
    image.onerror = () => setError('Foto tidak bisa dimuat untuk diedit');
    image.src = url;
  }, [url]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const move = useCallback((dx, dy) => {
    if (!img) return;
    setOff(clampOffset(img, deg, zoom, shape.ratio, dx, dy));
  }, [img, deg, zoom, shape]);

  // Geser posisi ikut jari / kursor
  function onPointerDown(e) {
    const frame = frameRef.current;
    if (!frame) return;
    // Posisi awal dicatat lebih dulu: setPointerCapture bisa melempar error
    // (mis. pointer sintetis), dan kalau itu terjadi gesernya jadi mati total.
    drag.current = { x: e.clientX, y: e.clientY, ...off, size: frame.clientWidth };
    try { frame.setPointerCapture?.(e.pointerId); } catch { /* tidak apa-apa */ }
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const { x, y, dx, dy, size } = drag.current;
    move(dx + (e.clientX - x) / size, dy + (e.clientY - y) / size);
  }
  const onPointerUp = () => { drag.current = null; };

  function rotate() {
    const next = (deg + 90) % 360;
    setDeg(next);
    setOff({ dx: 0, dy: 0 }); // bingkai berubah, posisi lama tidak relevan lagi
  }

  function reset() {
    setZoom(1);
    setDeg(0);
    setOff({ dx: 0, dy: 0 });
  }

  function pickShape(next) {
    setShape(next);
    setOff({ dx: 0, dy: 0 }); // bingkai berubah, posisi lama tidak relevan lagi
  }

  async function save() {
    if (!img) return;
    setSaving(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = Math.round(OUT * shape.ratio);
      const ctx = canvas.getContext('2d');
      // Sisa bingkai yang tidak tertutup foto diisi putih, bukan dipaksa penuh
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scale = coverScale(img, deg, zoom, shape.ratio) * OUT;

      ctx.translate(OUT / 2 + off.dx * OUT, canvas.height / 2 + off.dy * OUT);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Foto gagal disimpan');
      await onSave(new File([blob], 'foto-rapi.jpg', { type: 'image/jpeg' }));
    } catch (e) {
      // Kalau gambarnya dari domain lain tanpa izin, canvas menolak diekspor
      setError(e.name === 'SecurityError'
        ? 'Foto ini tidak bisa diedit dari browser. Coba unggah ulang fotonya.'
        : e.message);
      setSaving(false);
    }
  }

  // Pratinjau memakai perhitungan yang sama dengan hasil akhirnya
  const previewStyle = () => {
    if (!img) return {};
    const scale = coverScale(img, deg, zoom, shape.ratio) * 100;
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${img.naturalWidth * scale}%`,
      transform: `translate(calc(-50% + ${off.dx * 100}%), calc(-50% + ${off.dy * 100}%)) rotate(${deg}deg)`,
      transformOrigin: 'center',
      maxWidth: 'none',
    };
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="w-full sm:max-w-md bg-cream-50 rounded-t-3xl sm:rounded-3xl overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-cream-200">
          <p className="font-bold text-sm text-gray-800">✂️ {title}</p>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-200 text-gray-500 flex items-center justify-center">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Bentuk bingkai */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">Bentuk</span>
            <div className="flex gap-1 bg-cream-100 rounded-full p-0.5">
              {SHAPES.map(sh => (
                <button key={sh.key} onClick={() => pickShape(sh)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-full transition ${
                    shape.key === sh.key ? 'bg-matcha-800 text-white' : 'text-gray-500'
                  }`}>
                  {sh.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bingkai hasil — yang kelihatan di sini itu yang tersimpan */}
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ aspectRatio: `1 / ${shape.ratio}` }}
            className="relative w-full rounded-2xl overflow-hidden bg-white border-2 border-cream-200
                       cursor-move touch-none select-none"
          >
            {img
              ? <img src={url} alt="" style={previewStyle()} draggable={false} />
              : <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                  {error || 'Memuat foto…'}
                </div>}
            {/* Garis bantu sepertiga, biar gampang menengahkan */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Geser fotonya pakai jari · perkecil sampai 0,5× kalau mau semuanya muat
          </p>

          {/* Perbesar */}
          <div className="flex items-center gap-3">
            <span className="text-xs">🔍</span>
            <input
              type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom}
              onChange={e => {
                const z = Number(e.target.value);
                setZoom(z);
                if (img) setOff(o => clampOffset(img, deg, z, shape.ratio, o.dx, o.dy));
              }}
              className="flex-1 accent-matcha-700"
            />
            <span className="text-[11px] font-bold text-gray-500 w-10 text-right">
              {zoom.toFixed(1)}×
            </span>
          </div>

          {error && <p className="text-xs text-red-600 font-semibold text-center">{error}</p>}

          <div className="flex gap-2">
            <button onClick={rotate} disabled={!img}
              className="flex-1 text-xs font-bold py-2.5 rounded-2xl bg-cream-100 text-matcha-800
                         border-2 border-cream-300 disabled:opacity-50">
              🔄 Putar
            </button>
            <button onClick={reset} disabled={!img}
              className="flex-1 text-xs font-bold py-2.5 rounded-2xl bg-cream-100 text-matcha-800
                         border-2 border-cream-300 disabled:opacity-50">
              ↺ Semula
            </button>
          </div>

          <button onClick={save} disabled={!img || saving}
            className="btn-primary w-full py-3 disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
