// Label resi — satu sumber ukuran untuk cetak lewat browser (desktop)
// maupun lewat gambar (ponsel + aplikasi Niimbot).

// Ukuran label (mm). Niimbot B1 yang dipakai sehari-hari = 40 × 30.
// Ukuran huruf (pt) sesuai permintaan untuk B1; 30 × 20 mengikuti
// perbandingan yang sama supaya tetap muat.
// Semua ukuran huruf dinaikkan 1 (2026-09-24) supaya lebih terbaca.
export const LABEL_SIZES = {
  '40x30': { w: 40, h: 30, label: '40 × 30 mm (Niimbot B1)', owner: 10.5, name: 12.5, resi: 10.5, resiTail: 15,   date: 10 },
  '30x20': { w: 30, h: 20, label: '30 × 20 mm',              owner: 8,    name: 9.5,  resi: 8,    resiTail: 11.5, date: 7.5 },
};

const same = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Nama penerima berpola "J+nama" berasal dari marketplace — untuk label
// cukup pakai nama penggunanya saja.
const isJunkName = n => /^j\s*\+/i.test(String(n || '').trim());

// Kapan label cukup menampilkan satu nama
export const ownerOnly = r => !r.name || same(r.owner, r.name) || isJunkName(r.name);

export const labelToday = () =>
  new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

// Data satu label dari sebuah resi
export const labelRow = (parcel, ownerName = '') => ({
  owner: parcel.owner?.label || ownerName || '',
  name: parcel.recipient_name || '',
  resi: parcel.tracking_number || '',
});

// ── Gambar label untuk aplikasi printer di ponsel ───────────────────
//  Niimbot B1 mencetak lewat aplikasinya sendiri (Bluetooth), bukan lewat
//  dialog print browser. Jadi di ponsel label digambar ke canvas lalu
//  dibagikan/disimpan sebagai PNG — tinggal dibuka di aplikasi Niimbot.
const DPI = 203;                       // resolusi cetak Niimbot B1
const PX_PER_MM = DPI / 25.4;
const ptToPx = pt => (pt * DPI) / 72;
const FONT = '"Arial Narrow", Arial, Helvetica, sans-serif';

// Kecilkan huruf sampai muat selebar label; kalau sudah mentok, potong teks.
// Batas 0.5 dipakai supaya nama yang panjang sekali tetap utuh — huruf boleh
// mengecil sampai separuh sebelum terpaksa dipotong.
function fitText(ctx, text, maxWidth, sizePx, weight) {
  let size = sizePx;
  const set = s => { ctx.font = `${weight} ${s}px ${FONT}`; };
  set(size);
  while (ctx.measureText(text).width > maxWidth && size > sizePx * 0.5) {
    size -= 1;
    set(size);
  }
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return { text: out, size };
}

export function drawLabel(canvas, row, sizeKey = '40x30', { date = labelToday() } = {}) {
  const s = LABEL_SIZES[sizeKey] || LABEL_SIZES['40x30'];
  const W = Math.round(s.w * PX_PER_MM);
  const H = Math.round(s.h * PX_PER_MM);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  const padX = 1.5 * PX_PER_MM;
  const inner = W - padX * 2;
  const single = ownerOnly(row) || !row.owner;

  // Susun baris dulu supaya bisa ditaruh rata tengah
  const lines = [];
  if (!single) {
    lines.push({ kind: 'text', value: row.owner, px: ptToPx(s.owner), weight: '400', color: '#333' });
  }
  lines.push({
    kind: 'text',
    value: single ? (row.owner || row.name) : row.name,
    px: ptToPx(s.name), weight: '700', color: '#000',
  });

  const resi = String(row.resi || '').trim();
  const head = resi.length > 4 ? resi.slice(0, -4) : '';
  const tail = resi.length > 4 ? resi.slice(-4) : resi;
  lines.push({
    kind: 'resi', head, tail,
    px: ptToPx(s.resi), tailPx: ptToPx(s.resiTail),
  });

  const lineH = l => (l.kind === 'resi' ? l.tailPx : l.px) * 1.2;
  const total = lines.reduce((sum, l) => sum + lineH(l), 0);
  let y = (H - total) / 2;

  for (const l of lines) {
    const h = lineH(l);
    const baseline = y + h * 0.78;

    if (l.kind === 'text') {
      const fit = fitText(ctx, l.value, inner, l.px, l.weight);
      ctx.fillStyle = l.color;
      ctx.font = `${l.weight} ${fit.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(fit.text, W / 2, baseline);
    } else {
      // 4 angka terakhir dicetak lebih besar dan tebal
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000';
      let headPx = l.px;
      let tailPx = l.tailPx;
      const widths = () => {
        ctx.font = `500 ${headPx}px ${FONT}`;
        const wh = l.head ? ctx.measureText(l.head).width : 0;
        ctx.font = `900 ${tailPx}px ${FONT}`;
        return [wh, ctx.measureText(l.tail).width];
      };
      let [wHead, wTail] = widths();
      while (wHead + wTail > inner && tailPx > l.tailPx * 0.6) {
        headPx -= 1; tailPx -= 1;
        [wHead, wTail] = widths();
      }
      let x = (W - (wHead + wTail)) / 2;
      if (l.head) {
        ctx.font = `500 ${headPx}px ${FONT}`;
        ctx.fillText(l.head, x, baseline);
        x += wHead;
      }
      ctx.font = `900 ${tailPx}px ${FONT}`;
      ctx.fillText(l.tail, x, baseline);
    }
    y += h;
  }

  // Tanggal di pojok kanan bawah
  ctx.textAlign = 'right';
  ctx.fillStyle = '#555';
  ctx.font = `400 ${ptToPx(s.date)}px ${FONT}`;
  ctx.fillText(date, W - padX, H - 0.8 * PX_PER_MM);

  return canvas;
}

export const labelToBlob = canvas =>
  new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

export function labelFilename(row, sizeKey) {
  const clean = s => String(s || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `label-${clean(row.owner || row.name) || 'resi'}-${clean(row.resi)}-${sizeKey}.png`;
}
