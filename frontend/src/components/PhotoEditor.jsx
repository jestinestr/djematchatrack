import { useCallback, useEffect, useRef, useState } from 'react';

// Perapi foto arrival: geser, perbesar, putar, lalu simpan ulang.
//
// Dipakai untuk kasus sehari-hari "kurang ke tengah" atau "kurang ke kanan" —
// fotonya sudah bagus, cuma resinya tidak pas di bingkai. Daripada memotret
// ulang paketnya yang mungkin sudah dibuka, posisinya tinggal digeser.
//
// Hasilnya bujur sangkar, sama dengan bentuk cuplikan foto di galeri admin.
const OUT = 1400;          // sisi gambar hasil (px)
const MAX_ZOOM = 3;

// Ukuran gambar setelah diputar 90°/270° (sisinya bertukar)
const rotatedSize = (img, deg) =>
  (deg % 180 === 0 ? { w: img.naturalWidth, h: img.naturalHeight }
                   : { w: img.naturalHeight, h: img.naturalWidth });

// Skala supaya sisi terpendek foto menutup penuh bingkai (seperti object-fit:
// cover). Satuannya "kali lebar bingkai", jadi bisa dipakai untuk pratinjau
// maupun gambar hasil tanpa hitungan terpisah.
const coverScale = (img, deg, zoom) => {
  const { w, h } = rotatedSize(img, deg);
  return Math.max(1 / w, 1 / h) * zoom;
};

// Batas geser supaya bingkai tidak pernah kosong di pinggir
function clampOffset(img, deg, zoom, dx, dy) {
  const { w, h } = rotatedSize(img, deg);
  const scale = coverScale(img, deg, zoom);
  const limitX = Math.max(0, (w * scale - 1) / 2);
  const limitY = Math.max(0, (h * scale - 1) / 2);
  return {
    dx: Math.max(-limitX, Math.min(limitX, dx)),
    dy: Math.max(-limitY, Math.min(limitY, dy)),
  };
}

export default function PhotoEditor({ url, title = 'Atur Foto', onSave, onClose }) {
  const [img, setImg] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
    setOff(clampOffset(img, deg, zoom, dx, dy));
  }, [img, deg, zoom]);

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

  async function save() {
    if (!img) return;
    setSaving(true);
    setError('');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, OUT, OUT);

      const scale = coverScale(img, deg, zoom) * OUT;

      ctx.translate(OUT / 2 + off.dx * OUT, OUT / 2 + off.dy * OUT);
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
    const scale = coverScale(img, deg, zoom) * 100;
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
          {/* Bingkai hasil — yang kelihatan di sini itu yang tersimpan */}
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full aspect-square rounded-2xl overflow-hidden bg-cream-200
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
            Geser fotonya pakai jari, atur besarnya di bawah
          </p>

          {/* Perbesar */}
          <div className="flex items-center gap-3">
            <span className="text-xs">🔍</span>
            <input
              type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom}
              onChange={e => {
                const z = Number(e.target.value);
                setZoom(z);
                if (img) setOff(o => clampOffset(img, deg, z, o.dx, o.dy));
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
