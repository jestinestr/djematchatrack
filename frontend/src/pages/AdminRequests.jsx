import { useEffect, useState } from 'react';

function formatDate(str) {
  if (!str) return '-';
  return new Date(str).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_TAB = [
  { key: 'pending',  label: 'Menunggu',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'approved', label: 'Disetujui', color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'rejected', label: 'Ditolak',   color: 'text-red-500  bg-red-50   border-red-200'   },
];

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('pending');
  const [acting, setActing]     = useState(null); // id being processed

  function load(status) {
    setLoading(true);
    fetch(`/api/requests?status=${status}`)
      .then(r => r.json())
      .then(d => { setRequests(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(tab); }, [tab]);

  async function handleApprove(id) {
    setActing(id);
    const res = await fetch(`/api/requests/${id}/approve`, { method: 'PATCH' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Gagal menyetujui'); setActing(null); return; }
    setRequests(prev => prev.filter(r => r.id !== id));
    setActing(null);
  }

  async function handleReject(id) {
    if (!window.confirm('Tolak request ini?')) return;
    setActing(id);
    await fetch(`/api/requests/${id}/reject`, { method: 'PATCH' });
    setRequests(prev => prev.filter(r => r.id !== id));
    setActing(null);
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus request ini?')) return;
    await fetch(`/api/requests/${id}`, { method: 'DELETE' });
    setRequests(prev => prev.filter(r => r.id !== id));
  }

  const pendingCount = tab === 'pending' ? requests.length : null;

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">📬</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Setor Resi</h1>
          <p className="text-sm text-gray-500">Resi yang disetor pengguna</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 bg-white border border-cream-200 rounded-xl p-1 w-fit">
        {STATUS_TAB.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors ${
              tab === t.key ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-matcha-600">
          <div className="text-3xl mb-2 animate-pulse">📬</div>
          <p className="text-sm">Memuat...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">
            {tab === 'pending' ? '✅' : tab === 'approved' ? '📭' : '🗑️'}
          </div>
          <p className="font-medium">
            {tab === 'pending' ? 'Tidak ada request menunggu' : `Tidak ada request ${tab === 'approved' ? 'yang disetujui' : 'yang ditolak'}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-cream-100 bg-cream-50">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${r.type === 'HC' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                    {r.type === 'HC' ? '✈️ Hand Carry' : '🏭 Warehouse'}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(r.submitted_at)}</span>
                </div>
                {tab !== 'pending' && (
                  <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 transition-colors text-sm p-1">🗑</button>
                )}
              </div>

              {/* Card body */}
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  {/* CO Photo thumbnail */}
                  {r.co_photo_url && (
                    <div className="relative flex-shrink-0 cursor-pointer" onClick={() => window.open(r.co_photo_url, '_blank')}>
                      <img src={r.co_photo_url} alt="CO" className="w-14 h-14 object-cover rounded-xl border border-amber-200" />
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[9px] font-bold px-1 rounded-full leading-4">CO</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{r.recipient_name}</p>
                    <p className="text-sm font-mono text-gray-500 mt-0.5">{r.tracking_number}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs bg-matcha-50 text-matcha-700 px-1.5 py-0.5 rounded-full border border-matcha-100">
                        {r.parcel_type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
                      </span>
                      {r.notes && (
                        <span className="text-xs text-gray-400 italic truncate">"{r.notes}"</span>
                      )}
                    </div>
                  </div>

                  {/* Actions — only for pending */}
                  {tab === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleReject(r.id)}
                        disabled={acting === r.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleApprove(r.id)}
                        disabled={acting === r.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-matcha-800 hover:bg-matcha-700 text-white transition-colors disabled:opacity-50"
                      >
                        {acting === r.id ? '...' : '✓ Acc'}
                      </button>
                    </div>
                  )}

                  {/* Status badge for non-pending */}
                  {tab !== 'pending' && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                      tab === 'approved' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-500 border-red-200'
                    }`}>
                      {tab === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                    </span>
                  )}
                </div>

                {tab === 'approved' && r.reviewed_at && (
                  <p className="text-xs text-gray-400 mt-2">Disetujui {formatDate(r.reviewed_at)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
