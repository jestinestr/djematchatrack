-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 015
--  Biaya tambahan bertingkat juga untuk invoice box (Warehouse), bukan
--  cuma invoice batch. Satu baris biaya menempel ke salah satu: batch
--  (bersama pemiliknya) atau box.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE invoice_fees ALTER COLUMN batch_id      DROP NOT NULL;
ALTER TABLE invoice_fees ALTER COLUMN owner_code_id DROP NOT NULL;

ALTER TABLE invoice_fees
  ADD COLUMN IF NOT EXISTS box_id bigint REFERENCES boxes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS invoice_fees_box_idx ON invoice_fees (box_id);

COMMENT ON COLUMN invoice_fees.box_id IS
  'Diisi kalau biaya ini milik invoice box; batch_id dipakai untuk invoice batch';
