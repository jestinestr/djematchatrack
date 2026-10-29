// Syarat & ketentuan yang dibaca pelanggan di panelnya.
//
// Teks ini cuma bawaan: begitu admin menyimpan versinya sendiri di
// Settings → Info & TnC, yang dipakai adalah punya admin. Formatnya
// sederhana supaya gampang diedit tanpa ngerti HTML:
//   "## Judul"   → judul bagian
//   "- isi"      → butir
//   "**tebal**"  → huruf tebal
//   baris kosong → jarak antar bagian
// Tata cara pemakaian — bagian tetap di menu Info, bukan bagian dari
// syarat & ketentuan yang bisa diubah admin. Isinya alur yang sama buat
// semua pelanggan, dari belanja sampai barang dikirim.
export const TATA_CARA = [
  {
    judul: 'Belanja & setor resi',
    isi: 'Setelah checkout, salin nomor resinya lalu masukkan lewat tombol '
      + '**Setor Resi** di panel ini — sebelum barangnya sampai di warehouse. '
      + 'Satu resi satu setoran. Kalau nomornya salah ketik, pakai pilihan '
      + '**minta perbaikan** supaya admin yang membetulkan.',
  },
  {
    judul: 'Barang sampai di warehouse',
    isi: 'Begitu paketmu tiba, admin membukanya dan memotret isinya. '
      + 'Resi yang sudah difoto muncul di daftarmu lengkap dengan **foto arrival**-nya. '
      + 'Barang yang kamu minta direkam unboxing tidak dibuka sembarangan.',
  },
  {
    judul: 'Cek foto arrival maksimal H+3',
    isi: 'Buka fotonya dan pastikan barangnya benar, jumlahnya pas, dan tidak rusak. '
      + 'Komplain setelah lewat **3 hari** sulit ditindaklanjuti karena barangnya sudah masuk antrean packing.',
  },
  {
    judul: 'Minta box ditutup',
    isi: 'Kalau belanjaanmu sudah lengkap, pakai tombol **Minta Tutup Box**: '
      + 'pilih resi yang ikut dikirim, isi alamat lengkap, pilih ekspedisi, '
      + 'dan tentukan perlu asuransi atau tidak. Resi yang belum ada fotonya belum bisa ikut.',
  },
  {
    judul: 'Invoice & pembayaran',
    isi: 'Admin menimbang, menghitung biaya, lalu mengirim invoicenya. '
      + 'Pembayaran bisa dalam Yuan atau Rupiah memakai kurs yang tertulis di invoice itu. '
      + 'Kurang bayar ikut ditagih di invoice berikutnya, kelebihan jadi potongan.',
  },
  {
    judul: 'Barang dikirim',
    isi: 'Setelah lunas, boxnya ditutup dan dikirim ke alamat yang kamu tulis. '
      + 'Resi yang belum ikut kiriman ini otomatis masuk box berikutnya — tidak hilang.',
  },
];

export const TNC_DEFAULT = `## Setor resi
- Setiap pembelian **wajib disetor resinya** lewat tombol Setor Resi, sebelum barangnya sampai di warehouse.
- Kalau barang sudah sampai duluan dan resinya belum disetor sehingga admin yang menginput manual, dikenakan **Rp 1.000 per resi**.
- Resi yang diinput manual otomatis tercatat berjenis **Barang**.

## Tanggung jawab warehouse
- Warehouse **tidak bertanggung jawab atas tindakan scam** yang dilakukan oleh seller. Pastikan sendiri seller dan transaksimu sebelum membeli.
- Warehouse **bertanggung jawab atas barang yang hilang atau terjatuh karena kelalaian warehouse**, dengan penggantian **maksimal 50–80% dari harga barang**, atau dicarikan barang serupa bila warehouse menyanggupi.

## Jadwal update
- Update rutin **2× seminggu: Senin dan Jumat malam**. Di luar jadwal itu sifatnya opsional.
- Jadwal bisa berubah mengikuti cuaca. Perubahannya selalu **diinfokan di grup**.

## Foto arrival
- Mohon selalu aware dan **cek foto arrival maksimal H+3**. Lewat dari itu warehouse tidak dapat membantu follow up.
- Kalau ada paket yang keliru, **warehouse bantu follow up ke stasiun pengambilan paket**.

## Sama-sama nyaman
- Selalu aware dan pastikan transaksimu sendiri ya.
- Mohon **jangan rush dan jangan rude**. We should respect each other 💚`;

// Pengubah teks di atas jadi tampilan — dipakai panel pelanggan maupun
// pratinjau di sisi admin.
export function parseTnc(teks) {
  const blok = [];
  for (const baris of String(teks || '').split('\n')) {
    const t = baris.trim();
    if (!t) continue;
    if (t.startsWith('## ')) blok.push({ jenis: 'judul', isi: t.slice(3).trim() });
    else if (t.startsWith('- ')) blok.push({ jenis: 'butir', isi: t.slice(2).trim() });
    else blok.push({ jenis: 'teks', isi: t });
  }
  return blok;
}

// "**tebal**" dipecah jadi potongan biasa dan tebal
export function potongTebal(teks) {
  return String(teks).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(bagian =>
    bagian.startsWith('**') && bagian.endsWith('**')
      ? { tebal: true, isi: bagian.slice(2, -2) }
      : { tebal: false, isi: bagian }
  );
}
