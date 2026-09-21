-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 006
--  Paket pelanggan (khusus Warehouse): kuota jumlah resi per periode.
--  Paket hanya penghitung — tagihan resi tetap seperti biasa.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_packages (
  id            bigserial   PRIMARY KEY,
  owner_code_id bigint      NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  name          text        NOT NULL,              -- mis. "Paket A"
  quota         integer     NOT NULL CHECK (quota > 0),
  period_no     integer     NOT NULL DEFAULT 1,    -- periode ke-berapa (naik tiap perpanjang)
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS customer_packages_owner_idx ON customer_packages (owner_code_id, status);

-- Resi WH tercatat masuk paket (periode) yang mana
ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS package_id bigint REFERENCES customer_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wh_parcels_package_idx ON wh_parcels (package_id);
