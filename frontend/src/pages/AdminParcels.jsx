import { useEffect, useState, useCallback, useMemo } from 'react';
import AdminBatchCard from '../components/AdminBatchCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { rupiah, baseFee, formatWeight, sumParcels, formatMulti } from '../utils/format';

const META = {
  HC: { icon: '✈️', title: 'Hand Carry', path: 'hc' },
  WH: { icon: '🏭', title: 'Warehouse', path: 'wh' },
};

export default function AdminParcels({ type }) {
  const meta = META[type];
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterType, setFilterType] = useState('all');   // all | barang | paperbased
  const [filterFine, setFilterFine] = useState('all');   // all | fine | nofine
  const [filterFee, setFilterFee]   = useState('all');   // all | hasfee | nofee
  const [filterOwner, setFilterOwner] = useState('all'); // all | <ownerId> | none

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/parcels/${meta.path}/all`);
    const data = await res.json();
    setBatches((data || []).filter(b => b.status === 'active'));
    setLoading(false);
  }, [meta.path]);

  useEffect(() => { load(); }, [load]);

  function updateParcels(batchId, fn) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: fn(b.parcels || []) } : b
    ));
  }
  const handleParcelAdded   = (batchId, parcel)  => updateParcels(batchId, ps => [parcel, ...ps]);
  const handleParcelDeleted = (batchId, id)      => updateParcels(batchId, ps => ps.filter(p => p.id !== id));
  const handleParcelEdited  = (batchId, updated) => updateParcels(batchId, ps => ps.map(p => p.id === updated.id ? updated : p));

  const allParcels = useMemo(() => batches.flatMap(b => b.parcels || []), [batches]);
  const totals = useMemo(() => sumParcels(allParcels, type), [allParcels, type]);

  // Daftar pelanggan untuk dropdown filter
  const owners = useMemo(() => {
    const map = new Map();
    for (const p of allParcels) {
      if (p.owner && !map.has(String(p.owner.id))) map.set(String(p.owner.id), p.owner);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }, [allParcels]);

  const isFiltering =
    search.trim() || filterType !== 'all' || filterFine !== 'all' ||
    filterFee !== 'all' || filterOwner !== 'all';

  const filteredBatches = useMemo(() => {
    if (!isFiltering) return batches;
    const q = search.trim().toLowerCase();
    return batches.map(b => ({
      ...b,
      parcels: (b.parcels || []).filter(p => {
        if (q) {
          // Cari lewat nama penerima, nomor resi, nama pelanggan, atau kode akses
          const hay = [
            p.recipient_name, p.tracking_number,
            p.owner?.label, p.owner?.code,
          ].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (filterFine === 'fine'   && !(p.fine_amount > 0)) return false;
        if (filterFine === 'nofine' &&  (p.fine_amount > 0)) return false;
        const fee = baseFee(p, type) + (Number(p.additional_fee) || 0);
        if (filterFee === 'hasfee' && !(fee > 0)) return false;
        if (filterFee === 'nofee'  &&  (fee > 0)) return false;
        if (filterOwner === 'none' && p.owner) return false;
        if (filterOwner !== 'all' && filterOwner !== 'none' &&
            String(p.owner?.id) !== filterOwner) return false;
        return true;
      }),
    })).filter(b => b.parcels.length > 0);
  }, [batches, search, filterType, filterFine, filterFee, filterOwner, isFiltering, type]);

  const filteredTotal = filteredBatches.reduce((s, b) => s + b.parcels.length, 0);
  const orphanCount = allParcels.filter(p => !p.owner).length;

  function resetAll() {
    setSearch(''); setFilterType('all'); setFilterFine('all');
    setFilterFee('all'); setFilterOwner('all');
  }

  const stats = [
    { icon: '📦', label: 'Total Resi',   value: totals.count, color: 'text-matcha-800' },
    { icon: '👤', label: 'Pelanggan',    value: owners.length, color: 'text-sky-600' },
    { icon: '⚖️', label: 'Total Berat',  value: totals.weight ? formatWeight(totals.weight) : '—', color: 'text-blue-600' },
    { icon: '💰', label: 'Total Biaya',  value: formatMulti(totals), color: 'text-amber-600' },
    { icon: '⚠️', label: 'Total Denda',  value: totals.fine > 0 ? rupiah(totals.fine) : '—', color: 'text-red-500' },
  ];

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{meta.icon}</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">{meta.title}</h1>
          <p className="text-sm text-gray-500">
            {isFiltering ? `${filteredTotal} dari ${totals.count}` : totals.count} resi aktif
          </p>
        </div>
      </div>

      {/* Ringkasan */}
      {!loading && batches.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-cream-200 shadow-soft px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-xl">{s.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">{s.label}</p>
                <p className={`text-sm font-bold truncate ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pencarian + filter */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-3 mb-5 space-y-2.5">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, kode akses, atau nomor resi..."
            className="w-full input-field pl-9 pr-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Pelanggan */}
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="text-xs bg-cream-50 border border-cream-200 rounded-xl px-2.5 py-1.5 font-medium text-gray-600 focus:outline-none focus:border-matcha-400"
          >
            <option value="all">👤 Semua pelanggan</option>
            {owners.map(o => (
              <option key={o.id} value={String(o.id)}>{o.label} ({o.code})</option>
            ))}
            <option value="none">Tanpa pemilik</option>
          </select>

          <FilterGroup value={filterType} onChange={setFilterType}
            options={[['all','Semua'],['barang','📦 Barang'],['paperbased','📄 Paperbased']]} />

          <FilterGroup value={filterFee} onChange={setFilterFee}
            options={[['all','Semua'],['hasfee','💰 Ada Biaya'],['nofee','Tanpa Biaya']]} />

          <FilterGroup value={filterFine} onChange={setFilterFine}
            options={[['all','Semua'],['fine','⚠️ Denda'],['nofine','✓ Tanpa Denda']]} />

          {isFiltering && (
            <button onClick={resetAll}
              className="text-xs px-2.5 py-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-200 transition-colors font-medium">
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Peringatan resi yang belum punya pemilik */}
      {!loading && orphanCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3 mb-5 flex items-start gap-2.5">
          <span className="text-lg leading-none">⚠️</span>
          <div className="text-xs text-amber-800">
            <p className="font-semibold">{orphanCount} resi belum punya pemilik</p>
            <p className="text-amber-700 mt-0.5">
              Resi tanpa pemilik tidak muncul di panel pelanggan mana pun. Buka ✏️ pada resi
              tersebut lalu pilih Kode Akses pemiliknya — atau saring lewat filter
              <strong> 👤 Semua pelanggan → Tanpa pemilik</strong> untuk melihat daftarnya.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text="Memuat data..." />
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p>Tidak ada batch {type} aktif</p>
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
            type={type}
            onComplete={load}
            onParcelAdded={handleParcelAdded}
            onParcelDeleted={handleParcelDeleted}
            onParcelEdited={handleParcelEdited}
          />
        ))
      )}
    </div>
  );
}

function FilterGroup({ value, onChange, options }) {
  return (
    <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
            value === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}
