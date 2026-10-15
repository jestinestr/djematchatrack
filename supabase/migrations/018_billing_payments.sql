-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 018
--  Pembayaran atas invoice yang sudah ditagih. Satu penagihan boleh
--  dibayar beberapa kali, dan tiap pembayaran punya mata uangnya sendiri
--  (Yuan atau Rupiah) karena tagihannya memang campuran.
--
--  Kurang/lebih bayar TIDAK disimpan sebagai kolom — dihitung dari
--  selisih total tagihan dengan jumlah yang sudah dibayar, supaya tidak
--  pernah ketinggalan zaman waktu ada pembayaran baru masuk.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste, Run.
--  Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS billing_payments (
  id         bigserial   PRIMARY KEY,
  billing_id bigint      NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
  amount     numeric     NOT NULL,
  currency   text        NOT NULL DEFAULT 'CNY' CHECK (currency IN ('IDR', 'CNY')),
  note       text,
  paid_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_payments_billing_idx ON billing_payments (billing_id);

COMMENT ON TABLE billing_payments IS
  'Cicilan/pembayaran atas satu penagihan; kurang-lebihnya dihitung dari sini';
