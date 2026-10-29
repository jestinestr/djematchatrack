import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rupiah, sumParcels, formatMulti } from '../utils/format';

// Kalimat penyemangat harian — satu baris, tanpa ikon, biar halamannya tenang
const CHEERS = [
  'Tetap fokus, makin produktif.',
  'Pelan-pelan asal rapi.',
  'Satu resi selesai, satu beban hilang.',
  'Hari ini cukup, besok lanjut lagi.',
  'Rapi di awal, gampang di akhir.',
  'Santai tapi jalan terus.',
  'Kerja keras hari ini kelihatan bulan depan.',
  'Yang penting konsisten.',
];

// Kartu angka: putih, garis tipis, tanpa ikon. Warna cuma dipakai kalau
// angkanya memang perlu diperhatikan.
function Stat({ label, value, sub, perhatian }) {
  return (
    <div className="bg-white rounded-2xl border border-cream-200 px-4 py-3.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${
        perhatian ? 'text-amber-700' : 'text-matcha-900'
      }`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const namaBulan = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

export default function AdminOverview() {
  const [cheer] = useState(() => CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  const [batches, setBatches] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/wh/all').then(r => r.json()),
      fetch('/api/parcels/wh/boxes').then(r => r.json()),
    ]).then(([wh, boxData]) => {
      setBatches(Array.isArray(wh) ? wh : []);
      setBoxes(boxData.boxes || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const semua = batches.flatMap(b => b.parcels || []);

  // "Masih aktif" = belum terarsip dan belum ditandai lunas. Angka-angka
  // di bawah sengaja cuma menghitung itu, supaya yang terlihat memang
  // pekerjaan yang masih berjalan.
  const aktif = semua.filter(p => p.status !== 'archived' && !p.paid_at);

  const awalBulan = new Date();
  awalBulan.setDate(1);
  awalBulan.setHours(0, 0, 0, 0);
  const bulanIni = semua.filter(p => p.created_at && new Date(p.created_at) >= awalBulan);

  const totals = sumParcels(aktif, 'WH');
  const belumFoto = aktif.filter(p => !p.photo_url).length;
  const boxTerbuka = boxes.filter(b => b.status === 'open').length;

  const tautan = [
    { to: '/admin/wh', label: 'Kelola Warehouse', desc: `${aktif.length} resi aktif` },
    { to: '/admin/gallery', label: 'Recap Foto', desc: belumFoto ? `${belumFoto} belum difoto` : 'semua sudah difoto' },
    { to: '/admin/invoice', label: 'Invoice', desc: 'Tagih & cetak' },
    { to: '/admin/archive', label: 'Arsip', desc: `${boxes.filter(b => b.status !== 'open').length} box ditutup` },
  ];

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-matcha-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{cheer}</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-10 text-center">Memuat data…</p>
      ) : (
        <>
          {/* Berapa yang sudah terkumpul */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Resi terkumpul
          </p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Stat
              label={`Bulan ini · ${namaBulan.format(new Date())}`}
              value={bulanIni.length}
              sub="resi masuk sejak tanggal 1"
            />
            <Stat
              label="Total sejak awal"
              value={semua.length}
              sub={`${boxes.length} box seluruhnya`}
            />
          </div>

          {/* Yang masih berjalan */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Yang masih aktif
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Box terbuka" value={boxTerbuka} sub={`dari ${boxes.length} box`} />
            <Stat
              label="Belum ada foto"
              value={belumFoto}
              sub={belumFoto ? 'perlu difoto' : 'semua sudah difoto'}
              perhatian={belumFoto > 0}
            />
            <Stat label="Total tagihan" value={formatMulti(totals)} sub="belum ditandai lunas" />
            <Stat
              label="Total denda"
              value={totals.fine ? rupiah(totals.fine) : '—'}
              sub="resi input manual"
              perhatian={totals.fine > 0}
            />
          </div>

          {/* Pintasan — teks saja, tanpa ikon */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Pintasan
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tautan.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="bg-white border border-cream-200 rounded-2xl px-4 py-3 transition-colors
                           hover:border-matcha-300"
              >
                <p className="text-sm font-semibold text-matcha-900">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
