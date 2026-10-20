// Syarat & ketentuan yang dibaca pelanggan di panelnya.
//
// Teks ini cuma bawaan: begitu admin menyimpan versinya sendiri di
// Settings → Info & TnC, yang dipakai adalah punya admin. Formatnya
// sederhana supaya gampang diedit tanpa ngerti HTML:
//   "## Judul"   → judul bagian
//   "- isi"      → butir
//   "**tebal**"  → huruf tebal
//   baris kosong → jarak antar bagian
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
