import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ParcelCard from '../components/ParcelCard';
import ParcelDetailModal from '../components/ParcelDetailModal';
import RequestForm from '../components/RequestForm';
import LoadingSpinner from '../components/LoadingSpinner';
import { fetchAsUser, downloadMany, slugify } from '../utils/format';

const META = {
  HC: { icon: '✈️', title: 'Hand Carry', path: 'hc' },
  WH: { icon: '🏭', title: 'Warehouse', path: 'wh' },
};

export default function UserPanel({ type }) {
  const meta = META[type];
  const navigate = useNavigate();

  const [viewer, setViewer]   = useState(null);
  const [batches, setBatches] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [detail, setDetail]   = useState(null);
  const [photoFilter, setPhotoFilter] = useState('all'); // all | yes | no

  // Mode pilih foto untuk unduh massal
  const [picking, setPicking]     = useState(false);
  const [picked, setPicked]       = useState(new Set());
  const [progress, setProgress]   = useState(null);

  useEffect(() => {
    fetchAsUser(`/api/parcels/${meta.path}/view`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Gagal memuat data');
        return body;
      })
      .then(data => {
        setViewer(data.viewer);
        setBatches(data.batches);
        setActiveId(data.batches[0]?.id ?? null);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [meta.path]);

  const batch = useMemo(
    () => batches.find(b => b.id === activeId) || null,
    [batches, activeId]
  );

  const mine = useMemo(
    () => (batch?.parcels || []).filter(p => p.is_mine),
    [batch]
  );
  const others = useMemo(
    () => (batch?.parcels || []).filter(p => !p.is_mine),
    [batch]
  );

  const match = p =>
    !search.trim() ||
    p.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.tracking_number?.toLowerCase().includes(search.toLowerCase());

  const photoOk = p =>
    photoFilter === 'all' ||
    (photoFilter === 'yes' ? !!p.photo_url : !p.photo_url);

  const mineShown   = mine.filter(p => match(p) && photoOk(p));
  const othersShown = others.filter(match);

  const downloadable = mine.filter(p => p.photo_url);
  const photoDone = downloadable.length;
  const photoPct = mine.length ? Math.round((photoDone / mine.length) * 100) : 0;

  function togglePick(id) {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function pickAll() {
    if (picked.size === downloadable.length) setPicked(new Set());
    else setPicked(new Set(downloadable.map(p => p.id)));
  }

  async function handleDownload() {
    const targets = downloadable.filter(p => picked.has(p.id));
    if (!targets.length) return;
    setProgress({ done: 0, total: targets.length });
    await downloadMany(
      targets.map(p => ({
        url: p.photo_url,
        filename: `${slugify(p.recipient_name)}_${slugify(p.tracking_number)}`,
      })),
      (done, total) => setProgress({ done, total })
    );
    setProgress(null);
    setPicked(new Set());
    setPicking(false);
  }

  function selectBatch(id) {
    setActiveId(id);
    setSideOpen(false);
    setPicked(new Set());
    setPicking(false);
  }

  function exitSession() {
    sessionStorage.removeItem('access_code');
    sessionStorage.removeItem('access_label');
    navigate('/');
  }

  // ── Side panel: daftar batch ──────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #2A4A40 0%, #1E3D35 100%)' }}>
      <div className="px-4 py-4 border-b border-white/10">
        <p className="text-white font-bold text-sm flex items-center gap-2">
          <span>{meta.icon}</span> {meta.title}
        </p>
        {viewer && (
          <p className="text-matcha-300 text-xs mt-1 truncate">👤 {viewer.label}</p>
        )}
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Riwayat Batch</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {batches.length === 0 && (
          <p className="text-white/40 text-xs px-2 py-4">Belum ada batch</p>
        )}
        {batches.map(b => {
          const isSel = b.id === activeId;
          return (
            <button
              key={b.id}
              onClick={() => selectBatch(b.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 ${
                isSel ? 'bg-white/15 border border-white/10' : 'hover:bg-white/8 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isSel ? 'text-white' : 'text-white/70'}`}>
                  Batch #{b.batch_number}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  b.status === 'active' ? 'bg-green-400/20 text-green-300' : 'bg-white/10 text-white/50'
                }`}>
                  {b.status === 'active' ? '● Aktif' : '✓ Selesai'}
                </span>
              </div>
              <p className="text-[11px] text-matcha-300/80 mt-0.5">
                {b.mine_count} resi milikmu
                {b.is_private && <span className="ml-1.5 text-amber-300/80">🔒 private</span>}
              </p>
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/10">
        <button
          onClick={exitSession}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/80 transition-all"
        >
          <span>🚪</span> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-cream-100 overflow-hidden">
      {/* Sidebar desktop + drawer mobile */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 transition-transform duration-300
        ${sideOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        {sidebar}
      </aside>
      {sideOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSideOpen(false)} />
      )}

      {/* Konten */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="bg-matcha-800 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-md">
          <button onClick={() => setSideOpen(true)} className="md:hidden text-xl leading-none p-0.5">☰</button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm flex items-center gap-2">
              <span>{meta.icon}</span>
              {batch ? `Batch #${batch.batch_number}` : meta.title}
              {batch?.is_private && (
                <span className="text-[10px] bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded-full font-medium">🔒 Private</span>
              )}
            </h1>
            <p className="text-matcha-200 text-xs mt-0.5">
              {mine.length} resi milikmu
              {batch && batch.total_count > mine.length && ` · ${batch.total_count} resi di batch ini`}
            </p>
          </div>
          <button onClick={() => navigate('/')} className="text-matcha-200 hover:text-white text-xs underline underline-offset-2 flex-shrink-0">
            Beranda
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau nomor resi..."
                className="input-field pl-9 pr-8"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              )}
            </div>

            {/* Setor resi */}
            <button
              onClick={() => setShowRequest(v => !v)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border-2 border-dashed border-matcha-300 text-matcha-700 font-semibold text-sm hover:bg-matcha-50 hover:border-matcha-400 transition-all"
            >
              <span className="text-lg">📝</span>
              {showRequest ? 'Tutup Form' : `📨 Setor Resi ${type}`}
            </button>
            {showRequest && (
              <RequestForm
                type={type}
                unboxingFee={batches.find(b => b.status === 'active')?.unboxing_fee ?? 0.75}
                onSubmitted={() => setShowRequest(false)}
              />
            )}

            {loading && <LoadingSpinner text="Memuat data..." />}
            {error && (
              <div className="card text-center py-10 text-red-600">
                <p className="font-semibold">{error}</p>
                <button onClick={() => navigate('/')} className="btn-secondary mt-4">Kembali ke beranda</button>
              </div>
            )}

            {!loading && !error && !batch && (
              <div className="card text-center py-16 text-gray-400">
                <div className="text-4xl mb-3">📭</div>
                <p>Belum ada paket untukmu</p>
              </div>
            )}

            {!loading && !error && batch && (
              <>
                {/* Tracker foto — berapa resi yang sudah difoto */}
                {mine.length > 0 && (
                  <div className="bg-white border-2 border-cream-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">📸</span>
                      <p className="text-sm font-bold text-matcha-800 flex-1">
                        {photoDone} dari {mine.length} resi sudah ada foto
                      </p>
                      <span className={`text-xs font-bold ${photoPct === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                        {photoPct}%
                      </span>
                    </div>

                    <div className="h-2 bg-cream-200 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          photoPct === 100 ? 'bg-green-500' : 'bg-matcha-600'
                        }`}
                        style={{ width: `${photoPct}%` }}
                      />
                    </div>

                    <div className="flex gap-1.5">
                      {[
                        ['all', `Semua (${mine.length})`],
                        ['yes', `📷 Arrived photo (${photoDone})`],
                        ['no', `⏳ Not yet (${mine.length - photoDone})`],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => setPhotoFilter(v)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                            photoFilter === v
                              ? 'bg-matcha-800 text-white'
                              : 'bg-cream-50 text-gray-500 hover:text-matcha-700 border border-cream-200'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bar aksi foto */}
                {downloadable.length > 0 && (
                  <div className="flex items-center gap-2 bg-white border-2 border-cream-200 rounded-2xl px-3 py-2">
                    {picking ? (
                      <>
                        <button onClick={pickAll} className="text-xs font-semibold text-matcha-700 hover:underline">
                          {picked.size === downloadable.length ? 'Batal semua' : `Pilih semua (${downloadable.length})`}
                        </button>
                        <span className="text-xs text-gray-400">{picked.size} dipilih</span>
                        <div className="flex-1" />
                        <button
                          onClick={handleDownload}
                          disabled={!picked.size || !!progress}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-matcha-800 text-white disabled:opacity-40 transition-colors"
                        >
                          {progress ? `⏳ ${progress.done}/${progress.total}` : `⬇️ Download (${picked.size})`}
                        </button>
                        <button
                          onClick={() => { setPicking(false); setPicked(new Set()); }}
                          className="text-xs text-gray-400 hover:text-gray-600 px-2"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500">📸 {downloadable.length} foto tersedia</span>
                        <div className="flex-1" />
                        <button
                          onClick={() => setPicking(true)}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold border-2 border-cream-300 text-matcha-700 hover:bg-cream-50 transition-colors"
                        >
                          ⬇️ Download Foto
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Resi milik sendiri */}
                <section>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-matcha-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                      📦 Resi Kamu
                    </div>
                    <span className="text-xs text-gray-400">{mineShown.length} resi</span>
                    <div className="flex-1 h-px bg-cream-200" />
                  </div>
                  <p className="text-xs text-gray-400 mb-3 -mt-1">
                    Ketuk satu resi untuk melihat detail, foto, dan resi kamu yang lain di batch ini.
                  </p>

                  {mineShown.length === 0 ? (
                    <div className="card text-center py-10 text-gray-400">
                      <div className="text-3xl mb-2">{search ? '🔍' : '📭'}</div>
                      <p className="text-sm">
                        {search ? <>Tidak ada resi untuk <strong>"{search}"</strong></> : 'Belum ada resi kamu di batch ini'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mineShown.map(p => (
                        <ParcelCard
                          key={p.id}
                          parcel={p}
                          type={type}
                          selectable={picking && !!p.photo_url}
                          selected={picked.has(p.id)}
                          onSelect={() => togglePick(p.id)}
                          onOpen={() => setDetail(p)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Resi orang lain di batch yang sama */}
                {othersShown.length > 0 && (
                  <section>
                    <div className="flex items-center gap-3 mb-3 mt-6">
                      <div className="bg-cream-200 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">
                        {batch.is_private ? '🔒 Resi Lain (tersamar)' : '👥 Resi Lain'}
                      </div>
                      <span className="text-xs text-gray-400">{othersShown.length} resi</span>
                      <div className="flex-1 h-px bg-cream-200" />
                    </div>
                    <p className="text-xs text-gray-400 mb-3 -mt-1">
                      {batch.is_private
                        ? 'Resi milik pelanggan lain di batch yang sama. Nomor dan fotonya sengaja disembunyikan demi privasi mereka.'
                        : 'Resi milik pelanggan lain yang berangkat di batch yang sama.'}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {othersShown.map(p => (
                        <ParcelCard
                          key={p.id}
                          parcel={p}
                          type={type}
                          onOpen={() => (p.masked ? null : setDetail(p))}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {detail && (
        <ParcelDetailModal
          parcel={detail}
          type={type}
          siblings={mine}
          onSelectSibling={setDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
