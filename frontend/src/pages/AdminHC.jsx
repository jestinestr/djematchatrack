import { useEffect, useState, useCallback, useMemo } from 'react';
import AdminBatchCard from '../components/AdminBatchCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminHC() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('all');   // all | barang | paperbased
  const [filterFine, setFilterFine] = useState('all');   // all | fine | nofine

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/parcels/hc/all');
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
  const totalResi   = batches.reduce((s, b) => s + (b.parcels?.length || 0), 0);
  const totalWeight = batches.reduce((s, b) => s + (b.parcels || []).reduce((ps, p) => ps + (p.estimated_weight_grams || 0), 0), 0);
  const totalFee    = batches.reduce((s, b) => {
    const rate = b.fee_per_gram || 0;
    return s + (b.parcels || []).reduce((ps, p) => ps + (p.estimated_weight_grams || 0) * rate, 0);
  }, 0);
  const totalFine   = batches.reduce((s, b) => s + (b.parcels || []).reduce((ps, p) => ps + (p.fine_amount || 0), 0), 0);

  const isFiltering = search.trim() || filterType !== 'all' || filterFine !== 'all';

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
        return true;
      }),
    })).filter(b => b.parcels.length > 0);
  }, [batches, search, filterType, filterFine, isFiltering]);

  const filteredTotal = filteredBatches.reduce((s, b) => s + b.parcels.length, 0);

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">✈️</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Hand Carry</h1>
          <p className="text-sm text-gray-500">
            {isFiltering ? `${filteredTotal} dari ${totalResi}` : totalResi} resi aktif
          </p>
        </div>
      </div>

      {/* Totals summary */}
      {!loading && batches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { icon: '📦', label: 'Total Resi',  value: totalResi, color: 'text-matcha-800' },
            { icon: '⚖️', label: 'Total Berat', value: totalWeight >= 1000 ? (totalWeight/1000).toFixed(2)+' kg' : totalWeight+' g', color: 'text-blue-600' },
            { icon: '💰', label: 'Est. Fee',    value: totalFee > 0 ? 'Rp '+totalFee.toLocaleString('id-ID') : '—', color: 'text-matcha-600' },
            { icon: '⚠️', label: 'Total Denda', value: totalFine > 0 ? 'Rp '+totalFine.toLocaleString('id-ID') : '—', color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-cream-200 shadow-soft px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-xl">{s.icon}</span>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">{s.label}</p>
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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

          {/* Denda */}
          <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
            {[['all','Semua'],['fine','⚠️ Ada Denda'],['nofine','✓ Tanpa Denda']].map(([v,l]) => (
              <button key={v} onClick={() => setFilterFine(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterFine === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Reset */}
          {isFiltering && (
            <button onClick={() => { setSearch(''); setFilterType('all'); setFilterFine('all'); }}
              className="text-xs px-2.5 py-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 transition-colors font-medium">
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Memuat data..." />
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Tidak ada batch HC aktif</p>
        </div>
      ) : isFiltering && filteredBatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-3xl mb-2">🔍</div>
          <p>Tidak ada resi yang cocok</p>
          <button onClick={() => { setSearch(''); setFilterType('all'); setFilterFine('all'); }}
            className="mt-3 text-sm text-matcha-600 underline">Reset filter</button>
        </div>
      ) : (
        filteredBatches.map(b => (
          <AdminBatchCard
            key={b.id}
            batch={b}
            type="HC"
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
