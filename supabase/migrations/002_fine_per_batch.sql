-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 002
--  Besaran denda input manual jadi setelan per batch (sebelumnya
--  dipatok Rp 2.000 di dalam kode).
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste,
--  lalu Run. Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS fine_amount numeric NOT NULL DEFAULT 2000;

COMMENT ON COLUMN batches.fine_amount IS
  'Denda (Rupiah) yang dikenakan per resi kalau ditandai input manual. Diatur di halaman Control Tarif.';
