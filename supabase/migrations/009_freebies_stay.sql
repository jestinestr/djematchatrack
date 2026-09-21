-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 009
--  Penanda "freebies tinggal / stay" per resi (opsional, diisi pelanggan
--  saat setor atau admin saat input resi).
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE parcel_requests ADD COLUMN IF NOT EXISTS freebies_stay boolean NOT NULL DEFAULT false;
ALTER TABLE hc_parcels      ADD COLUMN IF NOT EXISTS freebies_stay boolean NOT NULL DEFAULT false;
ALTER TABLE wh_parcels      ADD COLUMN IF NOT EXISTS freebies_stay boolean NOT NULL DEFAULT false;
