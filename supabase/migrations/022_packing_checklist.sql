-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 022
--  Checklist packing: menandai resi yang barangnya sudah benar-benar
--  masuk ke dalam box.
--
--  Dipakai sesudah box ditutup, waktu isinya dimasukkan satu per satu ke
--  kardus — supaya ketahuan mana yang belum masuk sebelum dikirim.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS packed_at timestamptz;

CREATE INDEX IF NOT EXISTS wh_parcels_packed_idx ON wh_parcels (box_id, packed_at);

COMMENT ON COLUMN wh_parcels.packed_at IS
  'Kapan barangnya dicentang sudah masuk box; kosong = belum masuk';
