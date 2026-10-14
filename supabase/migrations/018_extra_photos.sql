-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 018
--  Foto tambahan per resi ("album"): satu resi bisa punya lebih dari satu
--  foto arrival. Foto utama tetap di photo_url; sisanya berurutan di sini.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali. Data lama tidak berubah.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE hc_parcels ADD COLUMN IF NOT EXISTS extra_photos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS extra_photos jsonb NOT NULL DEFAULT '[]'::jsonb;
