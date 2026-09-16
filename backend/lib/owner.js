const supabase = require('../supabase');

// Ambil semua kode akses sekali, dipakai untuk resolusi pemilik.
async function fetchCodes() {
  const { data, error } = await supabase
    .from('access_codes')
    .select('id, code, label, access_hc, access_wh');
  if (error) throw new Error(error.message);
  return data || [];
}

const norm = s => (s || '').trim().toLowerCase();

// Resolusi pemilik sebuah resi:
//  1. owner_code_id kalau sudah di-assign admin
//  2. fallback: cocokkan recipient_name dengan label kode akses
//
// PENTING: recipient_name diketik bebas oleh user saat setor resi, jadi
// tebakan nama TIDAK boleh dipakai untuk menentukan siapa yang berhak
// melihat sebuah resi — user bisa mengetik nama orang lain dan paketnya
// ikut muncul di panel orang itu. Fallback ini hanya untuk tampilan admin
// (sebagai saran yang ditandai `matched_by_name`), sementara panel
// pelanggan memakai allowNameMatch = false.
function resolveOwner(parcel, codes, allowNameMatch = true) {
  if (parcel.owner_code_id) {
    const c = codes.find(c => String(c.id) === String(parcel.owner_code_id));
    if (c) return { id: c.id, code: c.code, label: c.label, matched_by_name: false };
  }
  if (!allowNameMatch) return null;

  const byName = codes.find(c => norm(c.label) === norm(parcel.recipient_name));
  if (byName) return { id: byName.id, code: byName.code, label: byName.label, matched_by_name: true };
  return null;
}

// Tempelkan objek `owner` ke setiap resi.
function attachOwners(parcels, codes, { allowNameMatch = true } = {}) {
  return (parcels || []).map(p => ({ ...p, owner: resolveOwner(p, codes, allowNameMatch) }));
}

// Samarkan resi milik orang lain: hanya 4 digit terakhir + nama, foto disensor.
function maskParcel(p) {
  const tn = (p.tracking_number || '').trim();
  const tail = tn.slice(-4);
  return {
    id: p.id,
    batch_id: p.batch_id,
    masked: true,
    is_mine: false,
    recipient_name: p.recipient_name,
    tracking_number: tail ? `••••${tail}` : '••••',
    type: p.type,
    created_at: p.created_at,
    has_photo: !!p.photo_url,
    photo_url: null,
    co_photo_url: null,
    owner: p.owner ? { label: p.owner.label } : null,
  };
}

module.exports = { fetchCodes, resolveOwner, attachOwners, maskParcel, norm };
