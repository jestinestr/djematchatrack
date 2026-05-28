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
├── backend/
│   ├── index.js          # Express server (port 3001)
│   ├── db.js             # SQLite setup + seed awal
│   ├── djematcha.db      # Database (dibuat otomatis)
│   ├── routes/
│   │   ├── parcels.js    # CRUD resi HC & WH
│   │   ├── batches.js    # Manajemen batch
│   │   └── codes.js      # Kode akses
│   └── uploads/          # Foto paket (multer)
└── frontend/
    └── src/
        ├── pages/
        │   ├── Home.jsx           # Halaman utama + modal kode
        │   ├── HCPanel.jsx        # Panel HC untuk user
        │   ├── WHPanel.jsx        # Panel WH untuk user
        │   ├── AdminLogin.jsx     # Login admin
        │   ├── AdminDashboard.jsx # Dashboard admin
        │   └── AdminCodes.jsx     # Kelola kode akses
        └── components/
            ├── ParcelCard.jsx     # Kartu resi (user view)
            ├── BatchSection.jsx   # Grup batch (user view)
            └── AddParcelModal.jsx # Form tambah resi (admin)
```

---

## Fitur Utama

- **User**: masuk dengan kode akses → lihat semua resi aktif HC atau WH
- **Admin**: kelola batch, tambah/hapus resi, upload foto, selesaikan batch
- **Denda**: Rp 2.000 otomatis jika resi input manual
- **Foto**: upload foto paket, klik untuk perbesar
- **Batch**: auto-increment per tipe, arsip tersembunyi dari user
