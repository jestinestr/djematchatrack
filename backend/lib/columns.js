const supabase = require('../supabase');

// Kolom yang lahir dari file migrasi di supabase/migrations/ baru ada
// setelah SQL-nya dijalankan manual di Supabase (kode tidak bisa DDL).
// Supaya aplikasi tetap jalan di tengah-tengah, kolom baru dicek sekali
// lalu diingat, dan fitur yang bergantung padanya menyesuaikan diri.
// Jawaban "ada" diingat selamanya — kolom tidak akan hilang lagi.
// Jawaban "belum ada" sengaja tidak diingat lama: begitu migrasinya
// dijalankan, proses yang sedang hidup harus ikut sadar tanpa perlu
// di-restart dulu.
const found = new Set();
const missingUntil = new Map();
const RECHECK_MS = 30_000;

async function hasColumn(table, column) {
  const key = `${table}.${column}`;
  if (found.has(key)) return true;
  if ((missingUntil.get(key) || 0) > Date.now()) return false;

  const { error } = await supabase.from(table).select(column).limit(1);
  if (error) {
    missingUntil.set(key, Date.now() + RECHECK_MS);
    console.warn(`[db] kolom ${key} belum ada — jalankan migrasi di supabase/migrations/`);
    return false;
  }
  found.add(key);
  missingUntil.delete(key);
  return true;
}

// Buang field yang kolomnya belum ada, supaya insert/update tidak gagal
async function stripMissing(table, payload, columns) {
  for (const column of columns) {
    if (column in payload && !(await hasColumn(table, column))) delete payload[column];
  }
  return payload;
}

module.exports = { hasColumn, stripMissing };
