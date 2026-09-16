-- ════════════════════════════════════════════════════════════════════
--  Djematcha — Migration 003
--  Catatan aktivitas admin: siapa mengubah apa, kapan. Ditampilkan
--  di halaman Catatan sebagai memo harian.
--
--  CARA PAKAI: Supabase Dashboard > SQL Editor > New query, paste,
--  lalu Run. Aman dijalankan berulang kali.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_logs (
  id         bigserial   PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- jenis aksi: parcel_add, parcel_edit, parcel_delete, request_approve,
  -- request_reject, request_owner, batch_complete, batch_tarif,
  -- batch_private, code_add, code_edit, code_delete, note
  action     text NOT NULL,

  -- kalimat siap baca, mis. "Tambah resi JX123 (Caberry) di Batch HC #2"
  summary    text NOT NULL,

  -- keterangan tambahan, mis. rincian perubahan
  detail     text,

  ref_type   text,   -- 'hc_parcel' | 'wh_parcel' | 'batch' | 'request' | 'code'
  ref_id     text
);

CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs (created_at DESC);

COMMENT ON TABLE activity_logs IS
  'Riwayat perubahan yang dilakukan admin, ditampilkan per hari di halaman Catatan.';
