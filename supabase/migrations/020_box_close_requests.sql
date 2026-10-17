-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 020
--  Permintaan tutup box dari pelanggan.
--
--  Pelanggan memilih sendiri resi mana saja yang mau dikirim, menuliskan
--  alamatnya, lalu admin tinggal menyetujui. Syarat resi yang boleh ikut:
--  fotonya sudah diupload, supaya tidak ada barang yang dikirim sebelum
--  sempat dicek.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS box_close_requests (
  id              bigserial PRIMARY KEY,
  owner_code_id   bigint REFERENCES access_codes(id) ON DELETE SET NULL,
  box_id          bigint REFERENCES boxes(id) ON DELETE SET NULL,
  parcel_ids      jsonb   NOT NULL DEFAULT '[]'::jsonb,
  parcel_count    integer NOT NULL DEFAULT 0,

  -- Alamat tujuan, wajib diisi pelanggan
  recipient_name  text,
  phone           text,
  address         text    NOT NULL,

  -- Ekspedisi: 'general' bawaannya, 'sf' kalau pelanggan memang minta SF
  courier         text    NOT NULL DEFAULT 'general',
  -- Jawaban pelanggan soal barang cairan/baterai/mahal yang biasanya
  -- harus dialihkan ke SF
  sf_ok           boolean NOT NULL DEFAULT false,

  -- Asuransi: perlu atau tidak, dan kalau perlu nilainya berapa Yuan
  insurance       boolean NOT NULL DEFAULT false,
  insurance_cny   numeric NOT NULL DEFAULT 0,

  note            text,
  admin_note      text,
  status          text    NOT NULL DEFAULT 'pending',   -- pending|approved|rejected
  created_at      timestamptz NOT NULL DEFAULT now(),
  decided_at      timestamptz
);

CREATE INDEX IF NOT EXISTS box_close_requests_status_idx ON box_close_requests (status);
CREATE INDEX IF NOT EXISTS box_close_requests_owner_idx  ON box_close_requests (owner_code_id);

COMMENT ON TABLE box_close_requests IS
  'Permintaan tutup box dari pelanggan; admin tinggal approve atau tolak';
COMMENT ON COLUMN box_close_requests.sf_ok IS
  'Pelanggan setuju barang cairan/baterai/mahal dialihkan ke SF';
COMMENT ON COLUMN box_close_requests.insurance_cny IS
  'Nilai pertanggungan yang diminta pelanggan, dalam Yuan';
