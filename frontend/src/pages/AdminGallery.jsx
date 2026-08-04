import { useEffect, useState, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

function slugify(str) {
  return str?.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) || 'foto';
}

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? '.png' : '.jpg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + ext;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    // fallback: open in new tab
    window.open(url, '_blank');
  }
}

export default function AdminGallery() {
  const [hcBatches, setHcBatches] = useState([]);
  const [whBatches, setWhBatches] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');   // 'all'|'HC'|'WH'
  const [batchFilter, setBatchFilter] = useState('active'); // 'active'|batch_id
  const [selected, setSelected]   = useState(new Set());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/hc/all').then(r => r.json()),
      fetch('/api/parcels/wh/all').then(r => r.json()),
    ]).then(([hc, wh]) => {
      setHcBatches(hc);
      setWhBatches(wh);
      setLoading(false);
    });
  }, []);

  // Flatten all parcels with type + batch info
  const allParcels = useMemo(() => {
    const hc = hcBatches.flatMap(b =>
      (b.parcels || []).map(p => ({ ...p, _type: 'HC', _batch: b }))
    );
    const wh = whBatches.flatMap(b =>
      (b.parcels || []).map(p => ({ ...p, _type: 'WH', _batch: b }))
    );
    return [...hc, ...wh];
  }, [hcBatches, whBatches]);

  // All batches for dropdown
  const allBatches = useMemo(() => {
    const seen = new Set();
    const list = [];
    [...hcBatches, ...whBatches].forEach(b => {
      if (!seen.has(b.id)) { seen.add(b.id); list.push(b); }
    });
    return list.sort((a, b) => b.batch_number - a.batch_number);
  }, [hcBatches, whBatches]);

  // Filtered parcels (only with photos)
  const parcels = useMemo(() => {
    return allParcels.filter(p => {
      if (!p.photo_url) return false;
      if (typeFilter !== 'all' && p._type !== typeFilter) return false;
      if (batchFilter === 'active') return p._batch.status === 'active';
      if (batchFilter !== 'all') return p._batch.id === batchFilter;
      return true;
    });
  }, [allParcels, typeFilter, batchFilter]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === parcels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(parcels.map(p => p.id)));
    }
  }

  async function handleDownload() {
    const targets = parcels.filter(p => selected.has(p.id));
    if (!targets.length) return;
    setDownloading(true);
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      const filename = `${slugify(p.recipient_name)}_${slugify(p.tracking_number)}`;
      await downloadImage(p.photo_url, filename);
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    setDownloading(false);
  }

  const allSelected = parcels.length > 0 && selected.size === parcels.length;
  const someSelected = selected.size > 0;

  return (
    <div className="p-5 md:p-7">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">📸</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Recap Foto</h1>
          <p className="text-sm text-gray-500">Galeri foto arrival untuk cek koper</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Type filter */}
        <div className="flex gap-1 bg-white border border-cream-200 rounded-xl p-1">
          {[['all','Semua'],['HC','✈️ HC'],['WH','🏭 WH']].map(([v,l]) => (
            <button key={v} onClick={() => { setTypeFilter(v); setSelected(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${typeFilter === v ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Batch filter */}
        <select
          value={batchFilter}
          onChange={e => { setBatchFilter(e.target.value); setSelected(new Set()); }}
          className="input-field text-sm w-auto py-1.5"
        >
          <option value="active">Batch Aktif</option>
          <option value="all">Semua Batch</option>
          {allBatches.map(b => (
            <option key={b.id} value={b.id}>
              Batch #{b.batch_number} ({b.type}) {b.status === 'active' ? '● Aktif' : '✓ Selesai'}
            </option>
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Select all + download */}
        {parcels.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-xl border border-cream-300 bg-white text-gray-600 hover:bg-cream-50 font-medium transition-colors">
              {allSelected ? 'Batal Semua' : 'Pilih Semua'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!someSelected || downloading}
              className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl font-semibold transition-all ${
                someSelected
                  ? 'bg-matcha-800 hover:bg-matcha-700 text-white shadow-soft'
                  : 'bg-cream-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {downloading ? (
                <><span className="animate-spin">⏳</span> Downloading...</>
              ) : (
                <><span>⬇️</span> Download {someSelected ? `(${selected.size})` : ''}</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Gallery */}
      {loading ? (
        <LoadingSpinner text="Memuat foto..." />
      ) : parcels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-16 text-center text-gray-400">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="font-medium">Belum ada foto arrival</p>
          <p className="text-sm mt-1">Foto akan muncul di sini setelah admin upload</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">{parcels.length} foto ditemukan{someSelected ? `, ${selected.size} dipilih` : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {parcels.map(p => {
              const isSelected = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-matcha-500 shadow-soft-md scale-[0.98]'
                      : 'border-transparent hover:border-matcha-300 hover:shadow-soft'
                  }`}
                >
                  {/* Photo */}
                  <div className="aspect-square bg-cream-100 relative overflow-hidden">
                    <img
                      src={p.photo_url}
                      alt={p.recipient_name}
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay on hover/selected */}
                    <div className={`absolute inset-0 transition-opacity duration-150 ${isSelected ? 'bg-matcha-800/20' : 'bg-black/0 group-hover:bg-black/5'}`} />
                    {/* Checkbox */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'bg-matcha-600 border-matcha-600' : 'bg-white/80 border-gray-300 opacity-0 group-hover:opacity-100'
                    }`}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    {/* Type badge */}
                    <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      p._type === 'HC' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p._type === 'HC' ? '✈️' : '🏭'} #{p._batch.batch_number}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="bg-white px-2.5 py-2">
                    <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{p.recipient_name}</p>
                    <p className="text-[10px] font-mono text-gray-400 truncate mt-0.5">{p.tracking_number}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
