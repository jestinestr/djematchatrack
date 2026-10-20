// Label resi — ukuran dan aturan penulisan nama untuk cetak lewat browser.
//
// Catatan: versi gambar PNG untuk aplikasi Niimbot di ponsel pernah ada di
// sini, tapi dicabut atas permintaan — label sekarang dicetak dari PC saja.
// Kalau suatu saat dibutuhkan lagi, kodenya ada di riwayat git.

// Ukuran label (mm). Niimbot B1 yang dipakai sehari-hari = 40 × 30.
// Ukuran huruf (pt) sesuai permintaan untuk B1; 30 × 20 mengikuti
// perbandingan yang sama supaya tetap muat.
// 2026-09-24: semua ukuran naik 1, lalu nama pengguna jadi 11 dan nama
// penerima jadi 14 di B1 (30 × 20 ikut proporsinya, ~0,75).
// 2026-10-20: khusus 30 × 20 — isinya digeser 0,8 mm ke kanan karena
// cetakannya ketepian kiri, kedua namanya naik 1,25 pt, dan nomor resinya
// ditipiskan sedikit (ukurannya tetap).
//   nudge      = geser isi ke kanan, dalam mm
//   resiBobot  = ketebalan nomor resi; resiEkorBobot = 4 angka terakhir
export const LABEL_SIZES = {
  '40x30': { w: 40, h: 30, label: '40 × 30 mm (Niimbot B1)', owner: 11,   name: 14,    resi: 10.5, resiTail: 15,   date: 10,
             nudge: 0,   resiBobot: 500, resiEkorBobot: 900 },
  '30x20': { w: 30, h: 20, label: '30 × 20 mm',              owner: 9.25, name: 11.75, resi: 8,    resiTail: 11.5, date: 7.5,
             nudge: 0.8, resiBobot: 400, resiEkorBobot: 700 },
};

// Jarak tepi label: isi digeser ke kanan dengan menambah tepi kiri dan
// mengurangi tepi kanan sebanyak nudge, jadi lebar tulisannya tidak berubah.
export const labelPad = s => ({
  kiri: 1.5 + (s.nudge || 0),
  kanan: Math.max(0.5, 1.5 - (s.nudge || 0)),
  tanggalKanan: Math.max(0.6, 1.5 - (s.nudge || 0)),
});

const same = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Nama penerima berpola "J+nama" berasal dari marketplace — untuk label
// cukup pakai nama penggunanya saja.
const isJunkName = n => /^j\s*\+/i.test(String(n || '').trim());

// Kapan label cukup menampilkan satu nama
export const ownerOnly = r => !r.name || same(r.owner, r.name) || isJunkName(r.name);

export const labelToday = () =>
  new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

