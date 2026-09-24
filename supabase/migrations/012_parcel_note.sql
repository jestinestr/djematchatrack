-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 012
--  Catatan bebas per resi, menggantikan kolom Denda di form admin.
--  Denda (fine_amount) TIDAK dihapus supaya data lama tetap utuh —
--  kolomnya hanya tidak diisi lagi dari form.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE hc_parcels ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN hc_parcels.note IS 'Catatan bebas admin soal resi ini';
COMMENT ON COLUMN wh_parcels.note IS 'Catatan bebas admin soal resi ini';
