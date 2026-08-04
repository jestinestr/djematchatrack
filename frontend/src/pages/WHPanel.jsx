import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BatchSection from '../components/BatchSection';
import RequestForm from '../components/RequestForm';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WHPanel() {
  const navigate = useNavigate();
  const [batches, setBatches]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    fetch('/api/parcels/wh/active')
      .then(r => r.json())
      .then(data => { setBatches(data); setLoading(false); })
      .catch(() => { setError('Gagal memuat data'); setLoading(false); });
  }, []);

  const totalResi = batches.reduce((sum, b) => sum + (b.parcels?.length || 0), 0);

  const filteredBatches = search.trim()
    ? batches.map(b => ({
        ...b,
        parcels: (b.parcels || []).filter(p =>
          p.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.tracking_number?.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(b => b.parcels.length > 0)
    : batches;

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="bg-matcha-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              <h1 className="text-xl font-bold">Warehouse</h1>
            </div>
            <p className="text-matcha-200 text-sm mt-0.5">{totalResi} resi aktif</p>
          </div>
          <button onClick={() => navigate('/')} className="text-matcha-200 hover:text-white text-sm underline underline-offset-2">
            ← Kembali
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-matcha-900/30 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-matcha-300 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau nomor resi..."
              className="w-full bg-white/15 text-white placeholder-matcha-300 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-matcha-300 hover:text-white text-lg leading-none">×</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Request button */}
        <button
          onClick={() => setShowRequest(v => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-matcha-300 text-matcha-700 font-semibold text-sm hover:bg-matcha-50 hover:border-matcha-400 transition-all"
        >
          <span className="text-lg">📝</span>
          {showRequest ? 'Tutup Form' : '📨 Setor Resi WH'}
        </button>

        {/* Request form */}
        {showRequest && (
          <RequestForm
            type="WH"
            onSubmitted={() => setShowRequest(false)}
          />
        )}

        {/* Parcel list */}
        {loading && <LoadingSpinner text="Memuat data..." />}
        {error && <div className="card text-center py-8 text-red-600"><p>{error}</p></div>}
        {!loading && !error && batches.length === 0 && (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>Belum ada paket aktif</p>
          </div>
        )}
        {!loading && !error && batches.length > 0 && filteredBatches.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">🔍</div>
            <p>Tidak ada resi untuk <strong>"{search}"</strong></p>
          </div>
        )}
        {!loading && filteredBatches.map(b => (
          <BatchSection key={b.id} batch={b} type="wh" />
        ))}
      </div>
    </div>
  );
}
