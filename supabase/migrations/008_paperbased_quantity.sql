-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 008
--  Jumlah (pcs) untuk resi paperbased: wajib diisi saat setor resi,
--  terbawa ke resi saat di-acc. WH sebelumnya belum punya kolom qty.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE parcel_requests ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS estimated_quantity integer NOT NULL DEFAULT 1;
