const supabase = require('../supabase');
const { logActivity } = require('./log');

// Box terbuka milik pelanggan; yang terbaru dipakai kalau ada lebih dari satu
async function findOpenBox(ownerCodeId) {
  const { data } = await supabase
    .from('boxes').select('id')
    .eq('owner_code_id', ownerCodeId).eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

// Nomor box berikutnya = angka terbesar di akhir nama box pelanggan + 1.
// "Box 1" ditutup → "Box 2". Nama manual tanpa angka tidak mengganggu.
function nextBoxName(existing) {
  const used = new Set(existing.map(b => String(b.name).trim().toLowerCase()));
  let n = existing.reduce((max, b) => {
    const m = String(b.name).match(/(\d+)\s*$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0) + 1;
  while (used.has(`box ${n}`)) n++;
  return `Box ${n}`;
}

// Pastikan pelanggan punya box terbuka: pakai yang ada, kalau tidak ada
// buat otomatis (pelanggan baru → Box 1, box lama tertutup → Box berikutnya).
// Resi tanpa box milik pelanggan itu ikut dimasukkan.
async function ensureOpenBox(ownerCodeId) {
  if (!ownerCodeId) return null;

  const existingId = await findOpenBox(ownerCodeId);
  if (existingId) return existingId;

  const { data: all } = await supabase
    .from('boxes').select('name').eq('owner_code_id', ownerCodeId);
  const name = nextBoxName(all || []);

  const { data: box, error } = await supabase
    .from('boxes')
    .insert({ owner_code_id: parseInt(ownerCodeId), name })
    .select().single();
  if (error) return null; // jangan gagalkan input resi; jadi "tanpa box" dulu

  await supabase.from('wh_parcels')
    .update({ box_id: box.id })
    .eq('owner_code_id', box.owner_code_id).is('box_id', null);

  logActivity({
    action: 'box_add',
    summary: `Box otomatis dibuat: ${name}`,
    detail: 'Dibuat otomatis saat resi masuk dan pelanggan belum punya box terbuka',
    ref_type: 'box',
    ref_id: box.id,
  });
  return box.id;
}

// Tutup box dan arsipkan resi di dalamnya.
async function closeBox(boxId) {
  const { data, error } = await supabase
    .from('boxes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', boxId).select().single();
  if (error) return { error };
  await supabase.from('wh_parcels').update({ status: 'archived' }).eq('box_id', data.id);
  return { data };
}

// Dipanggil saat invoice box lunas: box ditutup (resi yang ditagih ikut
// terarsip). Resi lain di box itu yang belum ditagih dipindah dulu ke box
// baru yang dibuat otomatis, jadi tidak ikut terarsip dan tidak nyangkut.
// Mengembalikan { closed, moved, newBoxName }.
async function closeBoxAfterPaid(boxId, billedIds) {
  const { data: box } = await supabase
    .from('boxes').select('id, status, owner_code_id').eq('id', boxId).single();
  if (!box || box.status !== 'open') return { closed: false, moved: 0 };

  const { data: rows } = await supabase
    .from('wh_parcels').select('id').eq('box_id', boxId);
  const billed = new Set((billedIds || []).map(String));
  const leftover = (rows || []).filter(r => !billed.has(String(r.id))).map(r => r.id);
  // Tidak ada resi yang ditagih di box ini → bukan invoice box ini, jangan disentuh
  if (!(rows || []).some(r => billed.has(String(r.id)))) return { closed: false, moved: 0 };

  let newBoxName = null;
  if (leftover.length) {
    const { data: all } = await supabase
      .from('boxes').select('name').eq('owner_code_id', box.owner_code_id);
    newBoxName = nextBoxName(all || []);
    const { data: nb, error } = await supabase
      .from('boxes').insert({ owner_code_id: box.owner_code_id, name: newBoxName })
      .select().single();
    if (error) return { closed: false, moved: 0 }; // aman: box lama tetap terbuka
    await supabase.from('wh_parcels').update({ box_id: nb.id }).in('id', leftover);
  }

  const { error } = await closeBox(boxId);
  return { closed: !error, moved: leftover.length, newBoxName };
}

module.exports = { findOpenBox, ensureOpenBox, nextBoxName, closeBox, closeBoxAfterPaid };
