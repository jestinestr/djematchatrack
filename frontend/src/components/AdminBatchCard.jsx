import { useState } from 'react';
import AddParcelModal from './AddParcelModal';
import ParcelDetailModal from './ParcelDetailModal';
import { Fragment } from 'react';

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

export default function AdminBatchCard({ batch, type, onComplete, onParcelAdded, onParcelDeleted, onParcelEdited, readOnly = false }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingParcel, setEditingParcel] = useState(null);
  const [detailParcel, setDetailParcel] = useState(null);
  const [showParcels, setShowParcels] = useState(true);
  const [completing, setCompleting] = useState(false);

  const parcels = batch.parcels || [];
  const totalFines = parcels.reduce((s, p) => s + (p.fine_amount || 0), 0);
  const totalWHFee = type === 'WH' ? parcels.reduce((s, p) => s + (p.wh_fee || 0), 0) : 0;
  const isActive = batch.status === 'active';

  async function handleComplete() {
    if (!window.confirm(`Selesaikan Batch #${batch.batch_number}? Batch baru akan otomatis dibuat.`)) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/batches/${batch.id}/complete`, { method: 'POST' });
      if (res.ok) onComplete?.();
    } finally {
      setCompleting(false);
    }
  }

  async function handleDelete(parcelId) {
    if (!window.confirm('Hapus resi ini?')) return;
    const endpoint = type === 'HC' ? 'hc' : 'wh';
    await fetch(`/api/parcels/${endpoint}/${parcelId}`, { method: 'DELETE' });
    onParcelDeleted?.(parcelId);
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden mb-4 ${isActive ? 'border-matcha-200' : 'border-gray-200 opacity-80'}`}>
        {/* Batch header */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${isActive ? 'bg-matcha-50 border-b border-matcha-100' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${isActive ? 'bg-matcha-800 text-white' : 'bg-gray-400 text-white'}`}>
              Batch #{batch.batch_number}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isActive ? '● Aktif' : '✓ Selesai'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isActive && !readOnly && (
              <>
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-xs bg-matcha-800 hover:bg-matcha-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Tambah
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {completing ? '...' : '✅ Selesai'}
                </button>
              </>
            )}
            <button
              onClick={() => setShowParcels(v => !v)}
              className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 px-2 py-1.5 rounded-lg transition-colors"
            >
              {showParcels ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Batch stats */}
        <div className="px-4 py-2 flex gap-4 text-xs text-gray-500 border-b border-gray-100">
          <span>📦 {parcels.length} resi</span>
          {totalFines > 0 && <span className="text-red-500">⚠️ Denda {formatRupiah(totalFines)}</span>}
          {type === 'WH' && totalWHFee > 0 && <span className="text-amber-600">💰 WH Fee {formatRupiah(totalWHFee)}</span>}
          {!isActive && batch.completed_at && (
            <span className="text-gray-400 ml-auto">
              Selesai {new Date(batch.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Parcels list */}
        {showParcels && (
          <div className="divide-y divide-gray-50">
            {parcels.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">Belum ada resi di batch ini</p>
            ) : (
              parcels.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetailParcel(p)}>
                  {/* Photos */}
                  <div className="flex gap-1 flex-shrink-0">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="arrival" title="Foto Arrival" className="w-11 h-11 object-cover rounded-lg border border-gray-100" />
                    ) : (
                      <div className="w-11 h-11 bg-cream-100 rounded-lg flex items-center justify-center text-gray-300 border border-gray-100">📦</div>
                    )}
                    {p.co_photo_url && (
                      <div className="relative">
                        <img src={p.co_photo_url} alt="CO" title="Foto CO" className="w-11 h-11 object-cover rounded-lg border border-amber-200" />
                        <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[9px] font-bold px-1 rounded-full leading-4">CO</span>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.recipient_name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{p.tracking_number}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs bg-matcha-50 text-matcha-700 px-1.5 py-0.5 rounded-full border border-matcha-100">
                        {p.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
                      </span>
                      {type === 'HC' && p.estimated_weight_grams > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{p.estimated_weight_grams}g</span>
                      )}
                      {type === 'HC' && p.estimated_quantity > 1 && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">{p.estimated_quantity} pcs</span>
                      )}
                      {type === 'WH' && p.wh_fee > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">{formatRupiah(p.wh_fee)}</span>
                      )}
                      {p.fine_amount > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">⚠️ Denda {formatRupiah(p.fine_amount)}</span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  {!readOnly && (
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingParcel(p)}
                        className="text-gray-300 hover:text-matcha-600 transition-colors p-1"
                        title="Edit resi"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Hapus resi"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <AddParcelModal
          type={type}
          batchId={batch.id}
          onClose={() => setShowAdd(false)}
          onAdded={parcel => { onParcelAdded?.(batch.id, parcel); setShowAdd(false); }}
        />
      )}

      {editingParcel && (
        <AddParcelModal
          type={type}
          parcel={editingParcel}
          onClose={() => setEditingParcel(null)}
          onEdited={updated => { onParcelEdited?.(batch.id, updated); setEditingParcel(null); }}
        />
      )}

      {detailParcel && (
        <ParcelDetailModal
          parcel={detailParcel}
          type={type}
          isAdmin={true}
          onClose={() => setDetailParcel(null)}
        />
      )}
    </>
  );
}
