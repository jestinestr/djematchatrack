-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 004
--  Opsi video unboxing untuk Warehouse. Pelanggan mencentangnya saat
--  setor resi; biayanya (Yuan, per resi) diatur per batch di Control Tarif.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

-- Tarif video unboxing per batch (Yuan per resi)
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS unboxing_fee numeric NOT NULL DEFAULT 0.75;

-- Permintaan dari pelanggan saat setor resi
ALTER TABLE parcel_requests
  ADD COLUMN IF NOT EXISTS need_unboxing boolean NOT NULL DEFAULT false;

-- Resi WH: butuh unboxing + biayanya (dikunci saat resi dibuat/diedit)
ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS need_unboxing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unboxing_fee  numeric NOT NULL DEFAULT 0;
