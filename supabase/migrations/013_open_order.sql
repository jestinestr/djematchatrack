-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 013
--  Penanda urutan bongkar paket ("resi ini yang keberapa aku buka").
--  Sebelumnya cuma disimpan di browser PC, jadi tidak kelihatan dari HP
--  waktu upload foto. Sekarang ikut database supaya nyambung antar alat.
--
--  open_order   : nomor urut bongkar, kosong kalau belum/sudah selesai
--  open_printed : label resi ini sudah dicetak
--  Nomor dibersihkan otomatis begitu label tercetak DAN foto arrival masuk.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE hc_parcels
  ADD COLUMN IF NOT EXISTS open_order   integer,
  ADD COLUMN IF NOT EXISTS open_printed boolean NOT NULL DEFAULT false;

ALTER TABLE wh_parcels
  ADD COLUMN IF NOT EXISTS open_order   integer,
  ADD COLUMN IF NOT EXISTS open_printed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS hc_parcels_open_order_idx ON hc_parcels (open_order);
CREATE INDEX IF NOT EXISTS wh_parcels_open_order_idx ON wh_parcels (open_order);

COMMENT ON COLUMN hc_parcels.open_order IS 'Urutan paket ini dibuka saat bongkar, untuk mencocokkan foto arrival';
COMMENT ON COLUMN wh_parcels.open_order IS 'Urutan paket ini dibuka saat bongkar, untuk mencocokkan foto arrival';
