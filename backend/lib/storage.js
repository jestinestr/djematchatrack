const path = require('path');
const supabase = require('../supabase');

// Unggah satu file foto ke Supabase Storage, kembalikan URL publiknya.
// Dipakai bersama oleh route parcels (form admin lengkap) dan route photos
// (panel upload foto yang ringkas).
async function uploadPhoto(file) {
  if (!file) return null;
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const { error } = await supabase.storage
    .from('TrackFolder')
    .upload(filename, file.buffer, { contentType: file.mimetype });

  if (error) throw new Error('Upload foto gagal: ' + error.message);

  const { data } = supabase.storage.from('TrackFolder').getPublicUrl(filename);
  return data.publicUrl;
}

module.exports = { uploadPhoto };
