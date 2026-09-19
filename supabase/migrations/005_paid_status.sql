-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 005
--  Status lunas per resi. Resi yang sudah ditandai lunas tidak ikut
--  lagi di invoice berikutnya, jadi tagihan "mulai dari awal".
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE hc_parcels ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS paid_at timestamptz;
