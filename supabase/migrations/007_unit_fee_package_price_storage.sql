-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 007
--  - Tarif satuan WH per resi (Yuan), diatur per batch di Control Tarif
--  - Harga paket pelanggan (Yuan)
--  - Waktu foto arrival diupload → dasar hitungan "hari ke-N" disimpan
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS unit_fee numeric NOT NULL DEFAULT 1.5;

ALTER TABLE customer_packages
  ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;

ALTER TABLE hc_parcels ADD COLUMN IF NOT EXISTS photo_uploaded_at timestamptz;
ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS photo_uploaded_at timestamptz;

-- Resi lama yang sudah punya foto: pakai waktu resi dibuat sebagai perkiraan
UPDATE hc_parcels SET photo_uploaded_at = created_at
 WHERE photo_url IS NOT NULL AND photo_uploaded_at IS NULL;
UPDATE wh_parcels SET photo_uploaded_at = created_at
 WHERE photo_url IS NOT NULL AND photo_uploaded_at IS NULL;
