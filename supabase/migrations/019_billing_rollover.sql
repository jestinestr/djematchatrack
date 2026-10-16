-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 019
--  Penanda penagihan yang saldonya sudah digulung ke invoice berikutnya.
--
--  Tanpa ini, kurang/lebih bayar sebuah invoice akan ikut terhitung lagi
--  setiap kali invoice baru dibuat untuk pelanggan yang sama — padahal
--  saldonya sudah masuk ke invoice sebelumnya. Yang sudah digulung
--  ditandai di sini supaya tidak dihitung dua kali.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS rolled_into bigint REFERENCES billings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS billings_rolled_idx ON billings (rolled_into);

COMMENT ON COLUMN billings.rolled_into IS
  'Diisi id invoice berikutnya kalau kurang/lebih bayarnya sudah digulung ke sana';
