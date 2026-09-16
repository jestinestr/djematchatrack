# Djematcha Tracking 🍵

Sistem tracking paket untuk bisnis Hand Carry (HC) dan Warehouse (WH).

---

## Prasyarat

- [Node.js](https://nodejs.org/) v18+
- npm v9+

---

## Cara Menjalankan

### 1. Backend

```bash
cd djematcha/backend
npm install
npm start
```

Backend berjalan di **http://localhost:3001**

Untuk mode development (auto-restart):
```bash
npm run dev
```

### 2. Frontend

Buka terminal baru:

```bash
cd djematcha/frontend
npm install
npm run dev
```

Frontend berjalan di **http://localhost:5173**

---

## Akun Default

| Role  | Username / Kode | Password      |
|-------|-----------------|---------------|
| Admin | admin           | djematcha2024 |
| User  | djematcha123    | *(kode akses)*|

Admin login: **http://localhost:5173/admin**

---

## Struktur

```
djematcha/
├── supabase/migrations/   # SQL migrasi — jalankan di Supabase SQL Editor
├── backend/
│   ├── index.js           # Express server (port 3001)
│   ├── supabase.js        # Client Supabase (data + storage foto)
│   ├── lib/owner.js       # Resolusi pemilik resi + penyamaran data
│   └── routes/
│       ├── parcels.js     # CRUD resi HC & WH + tampilan user per pemilik
│       ├── batches.js     # Batch, tarif per gram, toggle private
│       ├── codes.js       # Kode akses
│       ├── requests.js    # Setor resi dari user
│       └── invoices.js    # Rekap & additional fee invoice per pelanggan
└── frontend/
    └── src/
        ├── utils/format.js        # Format mata uang, total, unduh foto
        ├── pages/
        │   ├── Home.jsx           # Halaman utama + modal kode
        │   ├── UserPanel.jsx      # Panel user (dipakai HCPanel & WHPanel)
        │   ├── AdminParcels.jsx   # Panel admin (dipakai AdminHC & AdminWH)
        │   ├── AdminInvoice.jsx   # Invoice per orang per batch
        │   ├── AdminTarif.jsx     # Tarif per gram + mata uangnya
        │   └── ...                # Overview, Gallery, Requests, Archive, Codes
        └── components/
            ├── ParcelCard.jsx        # Kartu resi (user view, dukung mode private)
            ├── ParcelDetailModal.jsx # Detail resi + resi lain di batch sama
            ├── AdminBatchCard.jsx    # Kartu batch admin (per resi / per orang)
            └── AddParcelModal.jsx    # Form tambah/edit resi (admin)
```

---

## Update Database (WAJIB sekali jalan)

Fitur kepemilikan resi, mata uang, additional fee, mode private, dan invoice
butuh kolom baru di Supabase. Buka **Supabase Dashboard > SQL Editor > New query**,
paste seluruh isi `supabase/migrations/001_ownership_currency_invoice.sql`, lalu **Run**.
Aman dijalankan berulang kali.

Migrasi itu juga menebak pemilik resi lama dari kecocokan nama penerima dengan
label kode akses. Resi yang namanya tidak cocok tetap "tanpa pemilik" dan perlu
di-assign manual lewat form edit resi.

---

## Fitur Utama

### User
- Masuk dengan kode akses → hanya melihat resi **miliknya sendiri**
- Side panel riwayat batch: batch aktif + batch lama yang berisi resinya
- Pilih beberapa foto sekaligus lalu download
- Detail resi menampilkan daftar resi lain miliknya di batch yang sama
- Setor resi (maks 10 sekaligus) — otomatis tercatat atas nama kode aksesnya

### Admin
- Kelola batch, tambah/edit/hapus resi, upload foto arrival + foto CO
- **Pemilik resi** dipilih dari daftar kode akses — menentukan siapa yang bisa melihat
- Cari resi lewat nama, **kode akses**, atau nomor resi; filter per pelanggan
- Tampilan **Per Orang**: klik nama pelanggan → daftar barangnya di batch itu
- **Mata uang per resi**: Rupiah atau Yuan, plus kolom **additional fee**
- **Mode private per batch**: pelanggan lain hanya melihat 4 digit terakhir resi +
  nama, foto disensor
- **Invoice per orang per batch**: additional fee manual per pelanggan,
  cetak banyak invoice sekaligus (print → PDF), dan export rekap CSV
- Denda Rp 2.000 otomatis jika resi input manual (selalu Rupiah)
- Batch auto-increment per tipe, arsip tersembunyi dari user
