import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CHEERS = [
  '🔥 Gaspol! Semangat kerja hari ini!',
  '💪 Tetap fokus, makin produktif!',
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

function StatCard({ icon, label, value, sub, color = 'matcha' }) {
  const colors = {
    matcha: 'bg-matcha-50 border-matcha-100 text-matcha-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    red: 'bg-red-50 border-red-100 text-red-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  const [hcData, setHcData] = useState([]);
  const [whData, setWhData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/hc/all').then(r => r.json()),
      fetch('/api/parcels/wh/all').then(r => r.json()),
    ]).then(([hc, wh]) => {
      setHcData(hc);
      setWhData(wh);
      setLoading(false);
    });
  }, []);

  const hcActive = hcData.filter(b => b.status === 'active');
  const whActive = whData.filter(b => b.status === 'active');

  const totalHCResi = hcActive.reduce((s, b) => s + (b.parcels?.length || 0), 0);
  const totalWHResi = whActive.reduce((s, b) => s + (b.parcels?.length || 0), 0);

  const allActiveParcels = [
    ...hcActive.flatMap(b => b.parcels || []),
    ...whActive.flatMap(b => b.parcels || []),
  ];
  const totalFines = allActiveParcels.reduce((s, p) => s + (p.fine_amount || 0), 0);
  const totalWHFees = whActive.flatMap(b => b.parcels || []).reduce((s, p) => s + (p.wh_fee || 0), 0);

  const hcCurrentBatch = hcActive[0];
  const whCurrentBatch = whActive[0];

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      {/* Cheers banner */}
      <div className="bg-gradient-to-r from-matcha-800 to-matcha-600 text-white rounded-2xl px-5 py-4 mb-6 shadow-md">
        <p className="font-semibold text-base">{cheer}</p>
        <p className="text-matcha-200 text-sm mt-1">
          {totalHCResi + totalWHResi} resi aktif hari ini
        </p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="text-center py-12 text-matcha-600">
          <div className="text-3xl mb-2 animate-pulse">📊</div>
          <p className="text-sm">Memuat data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard icon="✈️" label="Resi HC Aktif" value={totalHCResi} sub={`Batch #${hcCurrentBatch?.batch_number || '-'}`} color="matcha" />
            <StatCard icon="🏭" label="Resi WH Aktif" value={totalWHResi} sub={`Batch #${whCurrentBatch?.batch_number || '-'}`} color="blue" />
            <StatCard icon="⚠️" label="Total Denda" value={formatRupiah(totalFines)} color="red" />
            <StatCard icon="💰" label="Total WH Fee" value={formatRupiah(totalWHFees)} color="amber" />
          </div>

          {/* Quick links */}
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Aksi Cepat</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { to: '/admin/hc', icon: '✈️', label: 'Kelola HC', desc: `${totalHCResi} resi aktif` },
              { to: '/admin/wh', icon: '🏭', label: 'Kelola WH', desc: `${totalWHResi} resi aktif` },
              { to: '/admin/archive', icon: '📁', label: 'Lihat Arsip', desc: `${hcData.filter(b => b.status === 'completed').length + whData.filter(b => b.status === 'completed').length} batch selesai` },
              { to: '/admin/codes', icon: '🔑', label: 'Kode Akses', desc: 'Kelola akses user' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-white border border-cream-200 rounded-2xl p-4 hover:border-matcha-300 hover:shadow-md transition-all group"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="font-semibold text-matcha-800 text-sm group-hover:text-matcha-600">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
