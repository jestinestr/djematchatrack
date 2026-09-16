const supabase = require('../supabase');

// Catat aktivitas admin. Sengaja "fire and forget": kegagalan mencatat
// tidak boleh menggagalkan aksi yang sedang dikerjakan admin.
function logActivity({ action, summary, detail = null, ref_type = null, ref_id = null }) {
  if (!action || !summary) return;

  supabase
    .from('activity_logs')
    .insert({
      action,
      summary,
      detail,
      ref_type,
      ref_id: ref_id == null ? null : String(ref_id),
    })
    .then(({ error }) => {
      if (error) console.error('[log] gagal mencatat aktivitas:', error.message);
    })
    .catch(e => console.error('[log] gagal mencatat aktivitas:', e.message));
}

// Penulis label yang konsisten dipakai di beberapa route
const batchLabel = batch =>
  batch ? `Batch ${batch.type} #${batch.batch_number}` : 'batch';

const parcelLabel = (parcel, ownerLabel) => {
  const tn = parcel?.tracking_number || 'resi';
  return ownerLabel ? `${tn} (${ownerLabel})` : tn;
};

module.exports = { logActivity, batchLabel, parcelLabel };
