import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BatchSection from '../components/BatchSection';
import RequestForm from '../components/RequestForm';

export default function HCPanel() {
  const navigate = useNavigate();
  const [batches, setBatches]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    fetch('/api/parcels/hc/active')
      .then(r => r.json())
      .then(data => { setBatches(data); setLoading(false); })
      .catch(() => { setError('Gagal memuat data'); setLoading(false); });
  }, []);

  const totalResi = batches.reduce((sum, b) => sum + (b.parcels?.length || 0), 0);

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="bg-matcha-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">✈️</span>
              <h1 className="text-xl font-bold">Hand Carry</h1>
            </div>
            <p className="text-matcha-200 text-sm mt-0.5">{totalResi} resi aktif</p>
          </div>
          <button onClick={() => navigate('/')} className="text-matcha-200 hover:text-white text-sm underline underline-offset-2">
            ← Kembali
          </button>
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
          {showRequest ? 'Tutup Form' : '📨 Setor Resi HC'}
        </button>

        {/* Request form */}
        {showRequest && (
          <RequestForm
            type="HC"
            onSubmitted={() => setShowRequest(false)}
          />
        )}

        {/* Parcel list */}
        {loading && (
          <div className="text-center py-16 text-matcha-600">
            <div className="text-4xl mb-3 animate-pulse">📦</div>
            <p>Memuat data...</p>
          </div>
        )}
        {error && <div className="card text-center py-8 text-red-600"><p>{error}</p></div>}
        {!loading && !error && batches.length === 0 && (
          <div className="card text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>Belum ada paket aktif</p>
          </div>
        )}
        {!loading && batches.map(b => (
          <BatchSection key={b.id} batch={b} type="hc" />
        ))}
      </div>
    </div>
  );
}
