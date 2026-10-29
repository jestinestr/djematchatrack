import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rupiah, sumParcels, formatMulti, boxStorage, sisaSimpan, storageDays } from '../utils/format';

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
  const [paket, setPaket] = useState([]);
  const [batas, setBatas] = useState({ limit: 0, warn: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/wh/all').then(r => r.json()),
      fetch('/api/parcels/wh/boxes').then(r => r.json()),
      fetch('/api/packages').then(r => r.json()).catch(() => []),
    ]).then(([wh, boxData, pkg]) => {
      setBatches(Array.isArray(wh) ? wh : []);
      setBoxes(boxData.boxes || []);
      setPaket(Array.isArray(pkg) ? pkg : []);
      setLoading(false);
    }).catch(() => setLoading(false));

    fetch('/api/settings')
      .then(r => r.json())
      .then(d => setBatas({
        limit: Number(d.storage_limit_days) || 0,
        warn: Number(d.storage_warn_days) || 0,
      }))
      .catch(() => {});
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

  // Box terbuka yang jatah simpannya tinggal sedikit atau sudah lewat.
  // Yang paling mendesak di atas, supaya langsung kelihatan.
  const hampirHabis = boxes
    .filter(b => b.status === 'open')
    .map(b => {
      const umur = boxStorage(b, b.parcels || []);
      const sisa = sisaSimpan(umur, batas.limit);
      return sisa ? { box: b, ...sisa } : null;
    })
    .filter(x => x && x.sisa <= (batas.warn || 0))
    .sort((a, b) => a.sisa - b.sisa);

  // Resi yang paling lama mengendap — yang ini gampang terlupakan karena
  // tenggelam di daftar panjang. Cukup beberapa teratas; sisanya ada di
  // Warehouse yang bisa diurut "Terlama".
  const palingLama = aktif
    .map(p => ({ p, hari: storageDays(p, null) }))
    .filter(x => x.hari)
    .sort((a, b) => b.hari - a.hari)
    .slice(0, 6);

  // Pelanggan yang sudah seminggu lebih tidak setor resi — pantas disapa
  // duluan. Yang sedang berpaket aktif dilewati: jatahnya sudah dibayar di
  // muka, jadi sepinya bukan tanda mau pergi.
  const perluFollowUp = (() => {
    const berpaket = new Set(
      paket.filter(pk => pk.status === 'active' && pk.owner?.id)
           .map(pk => String(pk.owner.id))
    );

    const terakhir = new Map();   // id pemilik → setoran resi paling akhir
    for (const p of semua) {
      if (!p.owner?.id || !p.created_at) continue;
      const k = String(p.owner.id);
      const t = new Date(p.created_at).getTime();
      const ada = terakhir.get(k);
      if (!ada || t > ada.t) terakhir.set(k, { t, label: p.owner.label });
    }

    const sekarang = Date.now();
    return [...terakhir.entries()]
      .filter(([id]) => !berpaket.has(id))
      .map(([id, v]) => ({
        id,
        label: v.label,
        hari: Math.floor((sekarang - v.t) / 86400000),
        aktif: aktif.filter(p => String(p.owner?.id) === id).length,
      }))
      .filter(x => x.hari >= 7)
      .sort((a, b) => b.hari - a.hari)
      .slice(0, 4);
  })();

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

          {/* Durasi simpan yang mau habis — paling perlu ditindaklanjuti */}
          {hampirHabis.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Durasi simpan hampir habis
              </p>
              <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden mb-6">
                {hampirHabis.map(({ box, sisa, hari }) => (
                  <Link key={box.id} to="/admin/wh"
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-cream-100 last:border-0
                               hover:bg-cream-50 transition-colors">
                    <span className="text-sm font-semibold text-matcha-900 flex-1 truncate">
                      {box.owner?.label || '—'} · {box.name}
                    </span>
                    <span className="text-xs text-gray-400">{box.parcels?.length || 0} resi</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      sisa < 0 ? 'bg-red-100 text-red-700'
                        : sisa === 0 ? 'bg-amber-100 text-amber-800'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {sisa < 0 ? `lewat ${-sisa} hari` : sisa === 0 ? 'habis hari ini' : `sisa ${sisa} hari`}
                    </span>
                    <span className="text-[11px] text-gray-400 hidden sm:block">hari ke-{hari}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Pelanggan yang perlu disapa duluan */}
          {perluFollowUp.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Perlu di-follow up · sepi 7 hari
              </p>
              <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden mb-6">
                {perluFollowUp.map(o => (
                  <Link key={o.id} to="/admin/wh"
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-cream-100 last:border-0
                               hover:bg-cream-50 transition-colors">
                    <span className="text-sm font-semibold text-matcha-900 truncate flex-1">
                      {o.label || '—'}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
                      {o.aktif ? `${o.aktif} resi masih di gudang` : 'tidak ada resi aktif'}
                    </span>
                    <span className={`text-xs font-bold whitespace-nowrap ${
                      o.hari >= 21 ? 'text-red-600' : 'text-amber-700'
                    }`}>
                      {o.hari} hari sepi
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Resi yang sudah lama menginap */}
          {palingLama.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Resi paling lama menginap
              </p>
              <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden mb-6">
                {palingLama.map(({ p, hari }) => (
                  <Link key={p.id} to="/admin/wh"
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-cream-100 last:border-0
                               hover:bg-cream-50 transition-colors">
                    <span className="font-mono text-xs font-semibold text-gray-700 truncate max-w-[45%]">
                      {p.tracking_number}
                    </span>
                    <span className="text-xs text-gray-400 truncate flex-1">
                      {p.owner?.label || '—'}
                      {p.box?.name ? ` · ${p.box.name}` : ''}
                    </span>
                    {!p.photo_url && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200
                                       px-1.5 py-0.5 rounded-full whitespace-nowrap">tanpa foto</span>
                    )}
                    <span className={`text-xs font-bold whitespace-nowrap ${
                      hari >= 30 ? 'text-red-600' : hari >= 14 ? 'text-amber-700' : 'text-gray-500'
                    }`}>
                      {hari} hari
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

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
