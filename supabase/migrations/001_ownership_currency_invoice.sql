-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 001
--  Kepemilikan resi, mata uang per resi, additional fee, mode private,
--  dan invoice per orang per batch.
--
--  CARA PAKAI: buka Supabase Dashboard > SQL Editor > New query,
--  paste seluruh isi file ini, lalu Run. Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Batch: mode private + mata uang tarif ────────────────────────
ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS is_private   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_currency text    NOT NULL DEFAULT 'IDR';

-- ── 2. HC parcels: pemilik, mata uang, fee eksplisit, additional fee ─
ALTER TABLE hc_parcels
  ADD COLUMN IF NOT EXISTS owner_code_id  bigint,
  ADD COLUMN IF NOT EXISTS currency       text    NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS hc_fee         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fee numeric NOT NULL DEFAULT 0;

-- ── 3. WH parcels: pemilik, mata uang, additional fee ───────────────
ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS owner_code_id  bigint,
  ADD COLUMN IF NOT EXISTS currency       text    NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS additional_fee numeric NOT NULL DEFAULT 0;

-- wh_fee jadi numeric supaya bisa menampung pecahan Yuan (mis. 12.50)
ALTER TABLE wh_parcels ALTER COLUMN wh_fee TYPE numeric;

-- ── 4. Request setor resi: catat siapa yang menyetor ────────────────
ALTER TABLE parcel_requests
  ADD COLUMN IF NOT EXISTS owner_code_id bigint;

-- ── 5. Foreign key ke access_codes (pemilik) ────────────────────────
--  Dipasang terpisah + IF NOT EXISTS supaya aman di-rerun.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hc_parcels_owner_code_id_fkey') THEN
    ALTER TABLE hc_parcels ADD CONSTRAINT hc_parcels_owner_code_id_fkey
      FOREIGN KEY (owner_code_id) REFERENCES access_codes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wh_parcels_owner_code_id_fkey') THEN
    ALTER TABLE wh_parcels ADD CONSTRAINT wh_parcels_owner_code_id_fkey
      FOREIGN KEY (owner_code_id) REFERENCES access_codes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parcel_requests_owner_code_id_fkey') THEN
    ALTER TABLE parcel_requests ADD CONSTRAINT parcel_requests_owner_code_id_fkey
      FOREIGN KEY (owner_code_id) REFERENCES access_codes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS hc_parcels_owner_idx ON hc_parcels (owner_code_id);
CREATE INDEX IF NOT EXISTS wh_parcels_owner_idx ON wh_parcels (owner_code_id);

-- ── 6. Invoice per orang per batch ──────────────────────────────────
--  Menyimpan additional fee manual yang diketik admin di invoice.
CREATE TABLE IF NOT EXISTS batch_invoices (
  id                      bigserial PRIMARY KEY,
  batch_id                bigint  NOT NULL REFERENCES batches(id)      ON DELETE CASCADE,
  owner_code_id           bigint  NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  additional_fee          numeric NOT NULL DEFAULT 0,
  additional_fee_currency text    NOT NULL DEFAULT 'IDR',
  additional_note         text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, owner_code_id)
);

-- ── 7. Backfill: samakan hc_fee lama dengan berat x tarif batch ─────
UPDATE hc_parcels p
   SET hc_fee = COALESCE(p.estimated_weight_grams, 0) * COALESCE(b.fee_per_gram, 0)
  FROM batches b
 WHERE b.id = p.batch_id
   AND p.hc_fee = 0
   AND COALESCE(b.fee_per_gram, 0) > 0;

-- ── 8. Backfill: tebak pemilik dari kecocokan nama penerima <-> label
UPDATE hc_parcels p
   SET owner_code_id = c.id
  FROM access_codes c
 WHERE p.owner_code_id IS NULL
   AND lower(trim(p.recipient_name)) = lower(trim(c.label));

UPDATE wh_parcels p
   SET owner_code_id = c.id
  FROM access_codes c
 WHERE p.owner_code_id IS NULL
   AND lower(trim(p.recipient_name)) = lower(trim(c.label));
