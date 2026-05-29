import { useEffect, useState, useCallback } from 'react';
import AdminBatchCard from '../components/AdminBatchCard';

export default function AdminWH() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/parcels/wh/all');
    const data = await res.json();
    setBatches(data.filter(b => b.status === 'active'));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleParcelAdded(batchId, parcel) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: [parcel, ...(b.parcels || [])] } : b
    ));
  }

  function handleParcelDeleted(batchId, parcelId) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: (b.parcels || []).filter(p => p.id !== parcelId) } : b
    ));
  }

  function handleParcelEdited(batchId, updated) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: (b.parcels || []).map(p => p.id === updated.id ? updated : p) } : b
    ));
  }

  const totalResi = batches.reduce((s, b) => s + (b.parcels?.length || 0), 0);

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🏭</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Warehouse</h1>
          <p className="text-sm text-gray-500">{totalResi} resi aktif</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-matcha-600">
          <div className="text-3xl mb-2 animate-pulse">📦</div>
          <p className="text-sm">Memuat data...</p>
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Tidak ada batch WH aktif</p>
        </div>
      ) : (
        batches.map(b => (
          <AdminBatchCard
            key={b.id}
            batch={b}
            type="WH"
            onComplete={load}
            onParcelAdded={(batchId, p) => handleParcelAdded(batchId, p)}
            onParcelDeleted={(batchId, pid) => handleParcelDeleted(batchId, pid)}
            onParcelEdited={(batchId, updated) => handleParcelEdited(batchId, updated)}
          />
        ))
      )}
    </div>
  );
}
