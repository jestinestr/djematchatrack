import { useEffect, useState, useCallback, useMemo } from 'react';
import AdminBatchCard from '../components/AdminBatchCard';

export default function AdminWH() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('all');   // all | barang | paperbased
  const [filterFine, setFilterFine] = useState('all');   // all | fine | nofine
  const [filterFee, setFilterFee]   = useState('all');   // all | hasfee | nofee

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

  const isFiltering = search.trim() || filterType !== 'all' || filterFine !== 'all' || filterFee !== 'all';

  const filteredBatches = useMemo(() => {
    if (!isFiltering) return batches;
    return batches.map(b => ({
      ...b,
      parcels: (b.parcels || []).filter(p => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!p.recipient_name?.toLowerCase().includes(q) &&
              !p.tracking_number?.toLowerCase().includes(q)) return false;
        }
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (filterFine === 'fine'   && !(p.fine_amount > 0)) return false;
        if (filterFine === 'nofine' &&  (p.fine_amount > 0)) return false;
        if (filterFee  === 'hasfee' && !(p.wh_fee > 0))     return false;
        if (filterFee  === 'nofee'  &&  (p.wh_fee > 0))     return false;
        return true;
      }),
    })).filter(b => b.parcels.length > 0);
  }, [batches, search, filterType, filterFine, filterFee, isFiltering]);

  const filteredTotal = filteredBatches.reduce((s, b) => s + b.parcels.length, 0);

  function resetAll() { setSearch(''); setFilterType('all'); setFilterFine('all'); setFilterFee('all'); }

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">🏭</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Warehouse</h1>
          <p className="text-sm text-gray-500">
            {isFiltering ? `${filteredTotal} dari ${totalResi}` : totalResi} resi aktif
          </p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-3 mb-5 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor resi..."
            className="w-full input-field pl-9 pr-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Jenis */}
          <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
            {[['all','Semua'],['barang','📦 Barang'],['paperbased','📄 Paperbased']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterType(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* WH Fee */}
          <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
            {[['all','Semua'],['hasfee','💰 Ada Fee'],['nofee','Tanpa Fee']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterFee(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterFee === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Denda */}
          <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
            {[['all','Semua'],['fine','⚠️ Denda'],['nofine','✓ Tanpa Denda']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterFine(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterFine === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Reset */}
          {isFiltering && (
            <button onClick={resetAll}
              className="text-xs px-2.5 py-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 transition-colors font-medium">
              ✕ Reset
            </button>
          )}
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
      ) : isFiltering && filteredBatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <p>Tidak ada resi yang cocok</p>
          <button onClick={resetAll} className="mt-3 text-sm text-matcha-600 underline">Reset filter</button>
        </div>
      ) : (
        filteredBatches.map(b => (
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
