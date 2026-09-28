const supabase = require('../supabase');

// Kolom yang lahir dari file migrasi di supabase/migrations/ baru ada
// setelah SQL-nya dijalankan manual di Supabase (kode tidak bisa DDL).
// Supaya aplikasi tetap jalan di tengah-tengah, kolom baru dicek sekali
// lalu diingat, dan fitur yang bergantung padanya menyesuaikan diri.
const cache = new Map();

async function hasColumn(table, column) {
  const key = `${table}.${column}`;
  if (!cache.has(key)) {
    const { error } = await supabase.from(table).select(column).limit(1);
    cache.set(key, !error);
    if (error) {
      console.warn(`[db] kolom ${key} belum ada — jalankan migrasi di supabase/migrations/`);
    }
  }
  return cache.get(key);
}

// Buang field yang kolomnya belum ada, supaya insert/update tidak gagal
async function stripMissing(table, payload, columns) {
  for (const column of columns) {
    if (column in payload && !(await hasColumn(table, column))) delete payload[column];
  }
  return payload;
}

module.exports = { hasColumn, stripMissing };
