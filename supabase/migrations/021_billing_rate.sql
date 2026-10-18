-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 021
--  Kurs yang dipakai saat invoice dicetak, disimpan di penagihannya.
--
--  Dengan kurs tercatat, tagihan Yuan bisa dibayar pakai Rupiah: nominal
--  Rupiah yang masuk dihitung setara Yuan memakai kurs invoice itu, bukan
--  kurs hari ini — jadi angkanya tidak berubah-ubah setelah ditagih.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE billings
  ADD COLUMN IF NOT EXISTS cny_rate numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN billings.cny_rate IS
  'Kurs ¥1 = Rp sekian saat invoice ini dicetak; 0 = tidak dicatat';
