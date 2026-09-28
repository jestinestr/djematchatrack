-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 014
--  1. Biaya tambahan invoice boleh lebih dari satu baris, masing-masing
--     dengan keterangan sendiri (mis. "packing", "ongkir dalam kota").
--     Kolom lama batch_invoices.additional_fee TIDAK dihapus — nilainya
--     dipindah jadi baris pertama saat invoice itu diedit.
--  2. Pembayaran paket WH: DP bisa dicicil beberapa kali. Statusnya
--     (belum bayar / DP / lunas) dihitung dari jumlah bayar vs harga
--     paket, jadi tidak ada kolom status yang bisa ketinggalan zaman.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Biaya tambahan invoice ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_fees (
  id            bigserial   PRIMARY KEY,
  batch_id      bigint      NOT NULL REFERENCES batches(id)      ON DELETE CASCADE,
  owner_code_id bigint      NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  label         text,
  amount        numeric     NOT NULL DEFAULT 0,
  currency      text        NOT NULL DEFAULT 'IDR',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_fees_target_idx
  ON invoice_fees (batch_id, owner_code_id);

COMMENT ON TABLE invoice_fees IS
  'Biaya tambahan per pelanggan per batch, boleh banyak baris';

-- ── 2. Pembayaran paket WH ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS package_payments (
  id         bigserial   PRIMARY KEY,
  package_id bigint      NOT NULL REFERENCES customer_packages(id) ON DELETE CASCADE,
  amount     numeric     NOT NULL,
  note       text,
  paid_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS package_payments_package_idx
  ON package_payments (package_id);

COMMENT ON TABLE package_payments IS
  'Cicilan/DP pembayaran paket; status lunas dihitung dari totalnya';
