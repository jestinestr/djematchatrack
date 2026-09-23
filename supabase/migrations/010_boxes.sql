-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 010
--  Warehouse pindah dari struktur batch ke struktur BOX per pelanggan.
--  Satu pelanggan bisa punya banyak box, tiap box ditutup sendiri-sendiri.
--
--  Data lama tidak diubah: kolom batch_id di wh_parcels tetap ada dan
--  tetap terisi, resi lama cuma belum punya box (box_id NULL).
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS boxes (
  id            bigserial   PRIMARY KEY,
  owner_code_id bigint      NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  name          text        NOT NULL,               -- bebas: "Box 1", "Box A", dst
  status        text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS boxes_owner_idx ON boxes (owner_code_id, status);

ALTER TABLE wh_parcels ADD COLUMN IF NOT EXISTS box_id bigint REFERENCES boxes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS wh_parcels_box_idx ON wh_parcels (box_id);

-- ── Status download foto, dicatat terpisah untuk admin dan pelanggan ─
ALTER TABLE hc_parcels
  ADD COLUMN IF NOT EXISTS photo_dl_admin timestamptz,
  ADD COLUMN IF NOT EXISTS photo_dl_user  timestamptz;
ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS photo_dl_admin timestamptz,
  ADD COLUMN IF NOT EXISTS photo_dl_user  timestamptz;

-- ── Setelan global (tarif WH tidak lagi per batch) ──────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
