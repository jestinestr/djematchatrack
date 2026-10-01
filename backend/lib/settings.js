const supabase = require('../supabase');

// Setelan yang bisa diubah admin dari panel, disimpan sebagai pasangan
// key/value. Kalau tabelnya belum ada (migrasi 016 belum dijalankan),
// semua setelan dianggap memakai nilai bawaan — aplikasi tetap jalan.
const DEFAULTS = {
  auto_approve_requests: false,   // setoran resi langsung disetujui
};

async function getSetting(key) {
  const { data, error } = await supabase
    .from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return DEFAULTS[key];
  return data.value?.v ?? DEFAULTS[key];
}

async function getSettings() {
  const { data, error } = await supabase.from('app_settings').select('key, value');
  if (error) return { ...DEFAULTS, _ready: false };
  const out = { ...DEFAULTS, _ready: true };
  for (const row of data || []) out[row.key] = row.value?.v ?? out[row.key];
  return out;
}

// value dibungkus { v: ... } supaya jsonb bisa menampung boolean/angka/teks
async function setSetting(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: { v: value }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error('Setelan belum aktif — jalankan supabase/migrations/016_auto_acc_and_fix_request.sql');
  return value;
}

module.exports = { DEFAULTS, getSetting, getSettings, setSetting };
