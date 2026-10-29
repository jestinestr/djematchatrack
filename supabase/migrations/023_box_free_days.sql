-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 023
--  Bonus hari tanpa denda untuk durasi penyimpanan satu box.
--
--  Durasi box dihitung sejak paket pertama di box itu tiba (foto arrival
--  pertama). Kadang admin memberi kelonggaran — mis. pengiriman tertunda
--  cuaca — dan hari-hari itu tidak ikut dihitung. Angkanya disimpan di
--  sini, per box, jadi kelonggarannya tercatat bukan diingat-ingat.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE boxes
  ADD COLUMN IF NOT EXISTS free_days integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN boxes.free_days IS
  'Bonus hari tanpa denda; dipotong dari durasi penyimpanan box';
