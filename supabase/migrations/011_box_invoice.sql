-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 011
--  Additional fee manual yang diketik admin di invoice per box.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE boxes
  ADD COLUMN IF NOT EXISTS additional_fee          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fee_currency text    NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS additional_note         text;
