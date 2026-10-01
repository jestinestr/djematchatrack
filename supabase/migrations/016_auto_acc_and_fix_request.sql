-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 016
--  1. Setelan aplikasi yang bisa diubah admin dari panel (tanpa deploy),
--     dipakai pertama kali untuk mode auto ACC setor resi.
--  2. Jenis setoran: 'new' untuk resi baru, 'fix' untuk permintaan
--     perbaikan data resi yang sudah terlanjur masuk.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_settings IS
  'Setelan yang diubah admin dari panel, mis. auto_approve_requests';

ALTER TABLE parcel_requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new';

COMMENT ON COLUMN parcel_requests.kind IS
  'new = resi baru, fix = minta perbaikan data resi yang sudah ada';
