// Baca WAKTU JEPRET dari file foto.
//
// Dipakai untuk mencocokkan foto dengan urutan bongkar paket. Waktu upload
// tidak bisa dipakai: foto yang ukurannya lebih besar selesai belakangan.
//
// Sumber waktu, dari yang paling bisa diandalkan:
//   exif → DateTimeOriginal di dalam file JPEG (dicatat kamera saat jepret)
//   file → waktu file terakhir diubah; hanya cadangan, bisa saja waktu salin
//   none → tidak ada keterangan waktu sama sekali
//
// Harus dipanggil pada file ASLI — pengecilan foto (canvas) membuang EXIF.

const TAG_DATETIME = 0x0132;          // IFD0: DateTime
const TAG_EXIF_IFD = 0x8769;          // IFD0: penunjuk ke Exif IFD
const TAG_DT_ORIGINAL = 0x9003;       // Exif IFD: DateTimeOriginal
const TAG_DT_DIGITIZED = 0x9004;      // Exif IFD: DateTimeDigitized
const TAG_SUBSEC_ORIGINAL = 0x9291;   // Exif IFD: SubSecTimeOriginal

function readAscii(view, start, length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

// Ambil semua entri satu IFD → Map(tag → { type, count, valueOffset })
function readIfd(view, tiff, ifdOffset, little) {
  const entries = new Map();
  const start = tiff + ifdOffset;
  if (start + 2 > view.byteLength) return entries;
  const count = view.getUint16(start, little);
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    if (at + 12 > view.byteLength) break;
    entries.set(view.getUint16(at, little), {
      type: view.getUint16(at + 2, little),
      count: view.getUint32(at + 4, little),
      valueAt: at + 8,
    });
  }
  return entries;
}

// String ASCII dari satu entri (nilai > 4 byte disimpan di offset terpisah)
function entryString(view, tiff, entry, little) {
  if (!entry || entry.type !== 2) return null;
  const at = entry.count > 4 ? tiff + view.getUint32(entry.valueAt, little) : entry.valueAt;
  if (at + entry.count > view.byteLength) return null;
  return readAscii(view, at, entry.count);
}

// "2026:10:07 17:35:48" → ms (waktu lokal perangkat, sesuai jam kamera)
function parseExifDate(text, subsec) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(text || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  if (!y || !mo || !d) return null; // "0000:00:00" = kamera belum diset
  let ms = new Date(y, mo - 1, d, h, mi, s).getTime();
  if (Number.isNaN(ms)) return null;
  const frac = /^\d+/.exec(String(subsec || '').trim());
  if (frac) ms += Math.round(parseFloat(`0.${frac[0]}`) * 1000);
  return ms;
}

export function parseExifTime(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || view.getUint16(0) !== 0xffd8) return null; // bukan JPEG

  let pos = 2;
  while (pos + 4 < view.byteLength) {
    if (view.getUint8(pos) !== 0xff) return null;
    const marker = view.getUint8(pos + 1);
    if (marker === 0xda) return null;               // mulai data gambar, EXIF tidak ada
    const size = view.getUint16(pos + 2);

    if (marker === 0xe1 && readAscii(view, pos + 4, 4) === 'Exif') {
      const tiff = pos + 10;
      const order = view.getUint16(tiff);
      if (order !== 0x4949 && order !== 0x4d4d) return null;
      const little = order === 0x4949;
      if (view.getUint16(tiff + 2, little) !== 0x002a) return null;

      const ifd0 = readIfd(view, tiff, view.getUint32(tiff + 4, little), little);
      let exif = new Map();
      const ptr = ifd0.get(TAG_EXIF_IFD);
      if (ptr) exif = readIfd(view, tiff, view.getUint32(ptr.valueAt, little), little);

      const subsec = entryString(view, tiff, exif.get(TAG_SUBSEC_ORIGINAL), little);
      return (
        parseExifDate(entryString(view, tiff, exif.get(TAG_DT_ORIGINAL), little), subsec) ??
        parseExifDate(entryString(view, tiff, exif.get(TAG_DT_DIGITIZED), little), subsec) ??
        parseExifDate(entryString(view, tiff, ifd0.get(TAG_DATETIME), little), null)
      );
    }
    pos += 2 + size;
  }
  return null;
}

// → { time: ms | null, source: 'exif' | 'file' | 'none' }
export async function readCaptureTime(file) {
  try {
    const head = await file.slice(0, 256 * 1024).arrayBuffer(); // EXIF ada di awal file
    const t = parseExifTime(head);
    if (t != null) return { time: t, source: 'exif' };
  } catch { /* file tidak terbaca sebagai JPEG — pakai cadangan */ }

  if (file.lastModified) return { time: file.lastModified, source: 'file' };
  return { time: null, source: 'none' };
}
