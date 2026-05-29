import { useEffect, useState } from 'react';
import AdminBatchCard from '../components/AdminBatchCard';

export default function AdminArchive() {
  const [hcBatches, setHcBatches] = useState([]);
  const [whBatches, setWhBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'HC' | 'WH'

  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/hc/all').then(r => r.json()),
      fetch('/api/parcels/wh/all').then(r => r.json()),
    ]).then(([hc, wh]) => {
      setHcBatches(hc.filter(b => b.status === 'completed'));
      setWhBatches(wh.filter(b => b.status === 'completed'));
      setLoading(false);
    });
  }, []);

  function handleParcelEdited(batchId, updated, listSetter) {
    listSetter(prev => prev.map(b =>
      b.id === batchId
        ? { ...b, parcels: b.parcels.map(p => p.id === updated.id ? updated : p) }
        : b
    ));
  }

  function handleParcelDeleted(batchId, parcelId, listSetter) {
    listSetter(prev => prev.map(b =>
      b.id === batchId
        ? { ...b, parcels: b.parcels.filter(p => p.id !== parcelId) }
        : b
    ));
  }

  const showHC = filter === 'all' || filter === 'HC';
  const showWH = filter === 'all' || filter === 'WH';
  const totalArchived = hcBatches.length + whBatches.length;

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📁</span>
          <div>
            <h1 className="text-xl font-bold text-matcha-800">Arsip Batch</h1>
            <p className="text-sm text-gray-500">{totalArchived} batch selesai</p>
          </div>
        </div>
        {/* Filter */}
        <div className="flex gap-1.5 bg-white border border-cream-200 rounded-xl p-1">
          {[['all', 'Semua'], ['HC', '✈️ HC'], ['WH', '🏭 WH']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === val ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-matcha-600">
          <div className="text-3xl mb-2 animate-pulse">📁</div>
          <p className="text-sm">Memuat arsip...</p>
        </div>
      ) : totalArchived === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🗄️</div>
          <p>Belum ada batch yang diarsipkan</p>
          <p className="text-sm mt-1">Selesaikan batch aktif untuk melihatnya di sini</p>
        </div>
      ) : (
        <>
          {/* HC section */}
          {showHC && hcBatches.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">✈️</span>
                <h2 className="font-bold text-matcha-700 text-sm uppercase tracking-wide">Hand Carry</h2>
                <span className="text-xs text-gray-400">({hcBatches.length} batch)</span>
              </div>
              {hcBatches.map(b => (
                <AdminBatchCard
                  key={b.id} batch={b} type="HC"
                  onParcelEdited={(batchId, updated) => handleParcelEdited(batchId, updated, setHcBatches)}
                  onParcelDeleted={(parcelId) => handleParcelDeleted(b.id, parcelId, setHcBatches)}
                />
              ))}
            </div>
          )}

          {/* WH section */}
          {showWH && whBatches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🏭</span>
                <h2 className="font-bold text-matcha-700 text-sm uppercase tracking-wide">Warehouse</h2>
                <span className="text-xs text-gray-400">({whBatches.length} batch)</span>
              </div>
              {whBatches.map(b => (
                <AdminBatchCard
                  key={b.id} batch={b} type="WH"
                  onParcelEdited={(batchId, updated) => handleParcelEdited(batchId, updated, setWhBatches)}
                  onParcelDeleted={(parcelId) => handleParcelDeleted(b.id, parcelId, setWhBatches)}
                />
              ))}
            </div>
          )}

          {/* Empty filtered state */}
          {((filter === 'HC' && hcBatches.length === 0) || (filter === 'WH' && whBatches.length === 0)) && (
            <div className="bg-white rounded-2xl border border-cream-200 p-10 text-center text-gray-400">
              <p>Belum ada arsip untuk {filter}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
