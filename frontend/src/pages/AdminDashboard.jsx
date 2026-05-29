import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AddParcelModal from '../components/AddParcelModal';

const CHEERS = [
  '🔥 Gaspol! Semangat kerja hari ini!',
  '💪 Lagi jalan, tetap fokus!',
  '🚀 Paket makin banyak, makin cuan!',
  '⚡ Ayo tambah resi lagi!',
  '🎯 Djematcha selalu terdepan!',
  '🌟 Kerja keras terbayar!',
  '🏆 Tim terbaik, hasil terbaik!',
  '🍵 Santai tapi produktif!',
];

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function BatchCard({ batchData, type, onComplete, onParcelAdded, onParcelDeleted }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showParcels, setShowParcels] = useState(true);
  const [completing, setCompleting] = useState(false);

  const parcels = batchData.parcels || [];
  const totalFines = parcels.reduce((s, p) => s + (p.fine_amount || 0), 0);
  const totalWHFee = type === 'WH' ? parcels.reduce((s, p) => s + (p.wh_fee || 0), 0) : 0;

  async function handleComplete() {
    if (!window.confirm(`Selesaikan Batch #${batchData.batch_number}? Batch baru akan otomatis dibuat.`)) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/batches/${batchData.id}/complete`, { method: 'POST' });
      if (res.ok) onComplete();
    } finally {
      setCompleting(false);
    }
  }

  async function handleDelete(parcelId) {
    if (!window.confirm('Hapus resi ini?')) return;
    await fetch(`/api/parcels/${type === 'HC' ? 'hc' : 'wh'}/${parcelId}`, { method: 'DELETE' });
    onParcelDeleted(parcelId);
  }

  const isActive = batchData.status === 'active';

  return (
    <>
      <div className={`card mb-4 ${isActive ? 'border-matcha-300 shadow-md' : 'opacity-80'}`}>
        {/* Batch header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-base font-bold ${isActive ? 'text-matcha-800' : 'text-gray-600'}`}>
                Batch #{batchData.batch_number}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isActive ? 'Aktif' : 'Selesai'}
              </span>
            </div>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{parcels.length} resi</span>
              {totalFines > 0 && <span className="text-red-600">⚠️ Total denda {formatRupiah(totalFines)}</span>}
              {type === 'WH' && totalWHFee > 0 && <span className="text-amber-600">💰 WH {formatRupiah(totalWHFee)}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {isActive && (
              <>
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-xs bg-matcha-800 hover:bg-matcha-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Tambah Resi
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {completing ? '...' : '✅ Selesaikan'}
                </button>
              </>
            )}
            <button
              onClick={() => setShowParcels(v => !v)}
              className="text-xs btn-secondary px-2 py-1.5"
            >
              {showParcels ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Parcels list */}
        {showParcels && (
          <div className="space-y-2 mt-3 border-t border-cream-200 pt-3">
            {parcels.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">Belum ada resi</p>
            ) : (
              parcels.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-cream-50 rounded-xl p-3 border border-cream-200">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-cream-200 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-300 text-xl">📦</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-matcha-800 truncate">{p.recipient_name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{p.tracking_number}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs bg-matcha-100 text-matcha-700 px-1.5 py-0.5 rounded-full">
                        {p.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
                      </span>
                      {type === 'HC' && p.estimated_weight_grams > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{p.estimated_weight_grams}g</span>
                      )}
                      {type === 'WH' && p.wh_fee > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">{formatRupiah(p.wh_fee)}</span>
                      )}
                      {p.fine_amount > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">⚠️ Denda {formatRupiah(p.fine_amount)}</span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0 p-1"
                      title="Hapus resi"
                    >
                      🗑
                    </button>
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
          batchId={batchData.id}
          onClose={() => setShowAdd(false)}
          onAdded={parcel => {
            onParcelAdded(batchData.id, parcel);
            setShowAdd(false);
          }}
        />
      )}
    </>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [cheerIdx] = useState(() => Math.floor(Math.random() * CHEERS.length));
  const [hcBatches, setHcBatches] = useState([]);
  const [whBatches, setWhBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchivedHC, setShowArchivedHC] = useState(false);
  const [showArchivedWH, setShowArchivedWH] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [hc, wh] = await Promise.all([
      fetch('/api/parcels/hc/all').then(r => r.json()),
      fetch('/api/parcels/wh/all').then(r => r.json()),
    ]);
    setHcBatches(hc);
    setWhBatches(wh);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function logout() {
    sessionStorage.removeItem('admin_token');
    navigate('/admin');
  }

  function handleParcelAdded(batches, setBatches, batchId, parcel) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: [parcel, ...(b.parcels || [])] } : b
    ));
  }

  function handleParcelDeleted(batches, setBatches, batchId, parcelId) {
    setBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, parcels: (b.parcels || []).filter(p => p.id !== parcelId) } : b
    ));
  }

  const hcActive = hcBatches.filter(b => b.status === 'active');
  const hcArchived = hcBatches.filter(b => b.status === 'completed');
  const whActive = whBatches.filter(b => b.status === 'active');
  const whArchived = whBatches.filter(b => b.status === 'completed');

  const totalHCResi = hcActive.reduce((s, b) => s + (b.parcels?.length || 0), 0);
  const totalWHResi = whActive.reduce((s, b) => s + (b.parcels?.length || 0), 0);

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Top nav */}
      <div className="bg-matcha-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍵</span>
            <div>
              <h1 className="font-bold text-lg leading-tight">Djematcha Admin</h1>
              <p className="text-matcha-200 text-xs">Dashboard Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/codes" className="text-sm text-matcha-200 hover:text-white underline underline-offset-2">
              🔑 Kode Akses
            </Link>
            <button onClick={logout} className="text-sm text-matcha-200 hover:text-white">
              Keluar →
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Cheers banner */}
        <div className="bg-gradient-to-r from-matcha-700 to-matcha-600 text-white rounded-2xl p-4 mb-6 shadow-md">
          <p className="text-lg font-semibold">{CHEERS[cheerIdx]}</p>
          <p className="text-matcha-200 text-sm mt-1">
            {totalHCResi + totalWHResi} resi aktif total · HC: {totalHCResi} · WH: {totalWHResi}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-matcha-600">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p>Memuat data...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* HC Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">✈️</span>
                <h2 className="text-lg font-bold text-matcha-800">Hand Carry</h2>
                <span className="text-sm text-gray-400">({totalHCResi} aktif)</span>
              </div>

              {hcActive.map(b => (
                <BatchCard
                  key={b.id}
                  batchData={b}
                  type="HC"
                  onComplete={load}
                  onParcelAdded={(batchId, p) => handleParcelAdded(hcBatches, setHcBatches, batchId, p)}
                  onParcelDeleted={(batchId, pid) => handleParcelDeleted(hcBatches, setHcBatches, batchId, pid)}
                />
              ))}

              {hcArchived.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowArchivedHC(v => !v)}
                    className="text-sm text-matcha-600 hover:text-matcha-800 font-medium flex items-center gap-1"
                  >
                    {showArchivedHC ? '▲' : '▼'} Arsip HC ({hcArchived.length} batch)
                  </button>
                  {showArchivedHC && (
                    <div className="mt-3">
                      {hcArchived.map(b => (
                        <BatchCard
                          key={b.id}
                          batchData={b}
                          type="HC"
                          onComplete={load}
                          onParcelAdded={(batchId, p) => handleParcelAdded(hcBatches, setHcBatches, batchId, p)}
                          onParcelDeleted={(batchId, pid) => handleParcelDeleted(hcBatches, setHcBatches, batchId, pid)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WH Column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🏭</span>
                <h2 className="text-lg font-bold text-matcha-800">Warehouse</h2>
                <span className="text-sm text-gray-400">({totalWHResi} aktif)</span>
              </div>

              {whActive.map(b => (
                <BatchCard
                  key={b.id}
                  batchData={b}
                  type="WH"
                  onComplete={load}
                  onParcelAdded={(batchId, p) => handleParcelAdded(whBatches, setWhBatches, batchId, p)}
                  onParcelDeleted={(batchId, pid) => handleParcelDeleted(whBatches, setWhBatches, batchId, pid)}
                />
              ))}

              {whArchived.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowArchivedWH(v => !v)}
                    className="text-sm text-matcha-600 hover:text-matcha-800 font-medium flex items-center gap-1"
                  >
                    {showArchivedWH ? '▲' : '▼'} Arsip WH ({whArchived.length} batch)
                  </button>
                  {showArchivedWH && (
                    <div className="mt-3">
                      {whArchived.map(b => (
                        <BatchCard
                          key={b.id}
                          batchData={b}
                          type="WH"
                          onComplete={load}
                          onParcelAdded={(batchId, p) => handleParcelAdded(whBatches, setWhBatches, batchId, p)}
                          onParcelDeleted={(batchId, pid) => handleParcelDeleted(whBatches, setWhBatches, batchId, pid)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
