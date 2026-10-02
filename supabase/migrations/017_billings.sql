-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 017
--  Daftar penagihan yang sedang berlangsung. Satu baris lahir tiap kali
--  invoice dicetak, lalu ditandai lunas kalau pelanggan sudah bayar —
--  jadi admin tidak perlu mengingat sendiri siapa yang sudah ditagih.
--
--  parcel_ids disimpan supaya menandai lunas sekalian menandai resi-resi
--  di dalam invoice itu, tanpa menebak ulang isinya.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billings (
  id            bigserial   PRIMARY KEY,
  scope         text        NOT NULL CHECK (scope IN ('batch', 'box')),
  ref_id        bigint      NOT NULL,          -- batch_id atau box_id
  type          text        NOT NULL,          -- 'HC' | 'WH'
  owner_code_id bigint      REFERENCES access_codes(id) ON DELETE SET NULL,
  title         text,                          -- mis. "Warehouse Box 1 - Sorai"
  parcel_ids    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  parcel_count  integer     NOT NULL DEFAULT 0,
  total_idr     numeric     NOT NULL DEFAULT 0,
  total_cny     numeric     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz
);

CREATE INDEX IF NOT EXISTS billings_status_idx ON billings (status, issued_at DESC);
CREATE INDEX IF NOT EXISTS billings_target_idx ON billings (scope, ref_id, owner_code_id);

COMMENT ON TABLE billings IS
  'Invoice yang sudah dicetak dan statusnya ditunggu pembayarannya';
