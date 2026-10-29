import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compressImage } from '../utils/image';
import { clearSession, isUploader } from '../utils/auth';
import PhotoEditor from '../components/PhotoEditor';
import BulkPhotoUpload from '../components/BulkPhotoUpload';

// Panel khusus untuk pegang ponsel: cari resi, jepret/unggah foto, selesai.
// Sengaja tidak menampilkan biaya, denda, invoice, atau kode akses.

const SLOTS = [
  { key: 'photo', field: 'photo_url', label: 'Foto Arrival', hint: 'Foto paket saat datang' },
  { key: 'co',    field: 'co_photo_url', label: 'Foto CO',   hint: 'Opsional' },
];

const rowKey = p => `${p.kind}-${p.id}`;

function TypeBadge({ parcel }) {
  const isHC = parcel.kind === 'hc';
  const where = isHC
    ? (parcel.batch ? `#${parcel.batch.number}` : '—')
    : (parcel.box ? parcel.box.name : 'Tanpa box');
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
      isHC ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {isHC ? '✈️' : '🏭'} {where}
    </span>
  );
}

export default function PhotoAdmin() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const kind = 'wh';   // Hand Carry sudah dipensiunkan
  // 'belum' | 'unboxing' | 'semua' — satu saringan saja, supaya tidak
  // ada kombinasi yang membingungkan waktu dipakai sambil foto-foto
  const [saringan, setSaringan] = useState('belum');
  const missingOnly = saringan === 'belum';
  const unboxingOnly = saringan === 'unboxing';
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);    // resi yang sedang dibuka
  const [toast, setToast] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);   // naik → daftar resi dimuat ulang

  const toastTimer = useRef(null);
  const showToast = useCallback(msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── Ambil daftar resi (dengan jeda ketik) ────────────────────────
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (missingOnly) params.set('missing', '1');
      if (unboxingOnly) params.set('unboxing', '1');
      if (kind !== 'all') params.set('kind', kind);

      fetch(`/api/photos/worklist?${params}`, { signal: controller.signal })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          if (d.error) { setError(d.error); setParcels([]); }
          else { setError(''); setParcels(d.parcels || []); }
        })
        .catch(e => { if (!cancelled && e.name !== 'AbortError') setError('Koneksi gagal'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 350 : 0);

    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [query, kind, missingOnly, unboxingOnly, reloadTick]);

  // Perbarui satu baris di daftar tanpa memuat ulang semuanya
  const patchRow = useCallback((target, changes) => {
    setParcels(list => list.map(p => (rowKey(p) === rowKey(target) ? { ...p, ...changes } : p)));
    setActive(a => (a && rowKey(a) === rowKey(target) ? { ...a, ...changes } : a));
  }, []);

  // Admin yang mampir ke sini cukup balik ke panelnya — jangan sampai
  // ter-logout cuma gara-gara selesai upload foto. Akun khusus foto tidak
  // punya panel admin, jadi buat dia tombolnya tetap Keluar.
  const uploaderOnly = isUploader();

  function leave() {
    if (uploaderOnly) {
      clearSession();
      navigate('/admin');
    } else {
      navigate('/admin/wh');
    }
  }

  // Urutan kerja di lapangan: yang ditandai urutan buka paling atas,
  // lalu yang belum ada fotonya, baru yang sudah selesai.
  const urutKerja = useMemo(() => [...parcels].sort((a, b) => {
    const ta = a.open_order != null ? 0 : a.photo_url ? 2 : 1;
    const tb = b.open_order != null ? 0 : b.photo_url ? 2 : 1;
    if (ta !== tb) return ta - tb;
    if (ta === 0) return a.open_order - b.open_order;
    return 0;
  }), [parcels]);

  const withPhoto = parcels.filter(p => p.photo_url).length;
  const belumFoto = parcels.length - withPhoto;
  const needUnboxing = parcels.filter(p => p.need_unboxing).length;
  const markedCount = parcels.filter(p => p.open_order != null).length;

  return (
    <div className="min-h-screen bg-cream-100 pb-10">
      {/* ── Header ───────────────────────────── */}
      <header className="sticky top-0 z-20 shadow-soft-md"
              style={{ background: 'linear-gradient(135deg, #2A4A40 0%, #3D6B5E 100%)' }}>
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/25 flex-shrink-0">
              <img src="/ava.png" alt="Djematcha" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Upload Foto</p>
              <p className="text-matcha-200 text-[11px] opacity-80">Djematcha · panel foto</p>
            </div>
            <button onClick={leave}
              className="text-white/70 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 active:scale-95 transition whitespace-nowrap">
              {uploaderOnly ? 'Keluar' : '← Kembali'}
            </button>
          </div>

          {/* Pencarian */}
          <div className="relative mt-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cari nomor resi atau nama…"
              className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm font-semibold bg-white
                         placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-matcha-300"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-lg leading-none">
                ✕
              </button>
            )}
          </div>

          {/* Saringan — satu pilihan aktif, jadi jelas sedang lihat apa */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {[
              ['belum', 'Belum difoto'],
              ['unboxing', 'Unboxing'],
              ['semua', 'Semua resi'],
            ].map(([v, label]) => (
              <button key={v} onClick={() => setSaringan(v)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                  saringan === v ? 'bg-white text-matcha-800' : 'bg-white/15 text-white/75'
                }`}>
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setBulkOpen(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap bg-white/15 text-white transition">
              Upload banyak
            </button>
          </div>

          {/* Kemajuan hari ini — biar kelihatan sisa pekerjaannya */}
          {!loading && parcels.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] text-white/80 font-semibold">
                <span>{withPhoto} dari {parcels.length} sudah difoto</span>
                {belumFoto > 0 && <span className="text-amber-200">{belumFoto} belum</span>}
              </div>
              <div className="h-1.5 bg-white/20 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-white/80 transition-all duration-300"
                  style={{ width: `${Math.round((withPhoto / parcels.length) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Daftar resi ──────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 pt-4">
        {error && (
          <p className="bg-red-50 text-red-600 text-sm font-semibold px-4 py-3 rounded-2xl mb-3">{error}</p>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-[86px] rounded-3xl bg-white/70 border-2 border-cream-200 animate-pulse" />
            ))}
          </div>
        ) : parcels.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-cream-200 p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">{query ? '🔍' : unboxingOnly ? '🎥' : '🎉'}</div>
            <p className="font-bold text-gray-500">
              {query ? 'Resi tidak ditemukan'
                : unboxingOnly ? 'Tidak ada yang minta video unboxing'
                : 'Semua resi sudah ada fotonya'}
            </p>
            <p className="text-xs mt-1">
              {query ? 'Coba kata kunci lain' : 'Matikan saringan untuk melihat semua resi'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-gray-400 font-semibold mb-2 px-1">
              {parcels.length} resi{saringan === 'belum' ? ' belum difoto' : ''}
              {saringan !== 'belum' && ` · ${withPhoto} sudah ada foto`}
              {markedCount > 0 && <span className="text-matcha-700"> · 🔖 {markedCount} ditandai buka</span>}
              {needUnboxing > 0 && (
                <span className="text-violet-600"> · 🎥 {needUnboxing} minta unboxing</span>
              )}
            </p>
            <div className="space-y-2.5">
              {urutKerja.map(p => (
                <button key={rowKey(p)} onClick={() => setActive(p)}
                  className={`w-full flex items-center gap-3 rounded-3xl border-2 p-2.5
                              text-left active:scale-[0.99] transition shadow-soft ${
                    p.need_unboxing
                      ? 'bg-white border-violet-400 ring-2 ring-violet-100'
                      : p.photo_url
                        ? 'bg-cream-50/70 border-cream-200'
                        : 'bg-white border-cream-200 active:border-matcha-300'
                  }`}>
                  {/* Nomor urut bongkar, ditandai admin dari PC */}
                  {p.open_order != null && (
                    <span className="w-7 h-7 rounded-xl bg-matcha-800 text-white text-xs font-black
                                     flex items-center justify-center flex-shrink-0"
                          title={`Paket ke-${p.open_order} yang dibuka`}>
                      {p.open_order}
                    </span>
                  )}

                  {/* Cuplikan foto */}
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-cream-100
                                  border-2 border-cream-200 flex items-center justify-center">
                    {p.photo_url
                      ? <img src={p.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <span className="text-2xl opacity-40">📷</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    {p.need_unboxing && (
                      <p className="text-[10px] font-extrabold text-violet-700 leading-tight mb-0.5">
                        🎥 JANGAN DIBUKA — rekam unboxing
                      </p>
                    )}
                    <p className="font-bold text-sm text-gray-800 truncate leading-tight">
                      {p.recipient_name || '—'}
                    </p>
                    <p className="font-mono text-[11px] text-gray-400 truncate mt-0.5">{p.tracking_number}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <TypeBadge parcel={p} />
                      {p.owner && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-matcha-50 text-matcha-700">
                          👤 {p.owner.label}
                        </span>
                      )}
                      {p.co_photo_url && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                          CO ✓
                        </span>
                      )}
                    </div>
                  </div>

                  <span className={`flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center text-base ${
                    p.photo_url ? 'bg-matcha-50 text-matcha-600' : 'bg-berry-50 text-berry-500'
                  }`}>
                    {p.photo_url ? '✓' : '📸'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {active && (
        <ParcelSheet
          parcel={active}
          onClose={() => setActive(null)}
          onChanged={patchRow}
          onToast={showToast}
        />
      )}

      {bulkOpen && (
        <BulkPhotoUpload
          onClose={() => setBulkOpen(false)}
          onToast={showToast}
          onFinished={() => setReloadTick(t => t + 1)}
        />
      )}

      {/* Notifikasi singkat */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
          <p className="bg-matcha-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-soft-lg whitespace-nowrap">
            {toast}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Layar detail: unggah foto + ubah data seperlunya ────────────────
// Satu kotak foto: dipakai untuk foto arrival, foto tambahan, dan foto CO,
// supaya semuanya punya fitur yang sama (lihat, atur posisi, ganti, hapus).
function PhotoCard({ label, hint, url, uploading, onPick, onZoom, onEdit, onRemove }) {
  const pick = e => { onPick(e.target.files?.[0]); e.target.value = ''; };

  // Dua jalan masuk yang jelas: foto lama dari galeri, atau jepret
  // sekarang. Tombol galeri sengaja tanpa `capture`, karena atribut
  // itu memaksa kamera dan justru menutup akses galeri di ponsel.
  const PickButton = ({ camera, className, children }) => (
    <label className={`cursor-pointer text-center ${className}`}>
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: 'environment' } : {})}
        className="hidden"
        disabled={uploading}
        onChange={pick}
      />
      {children}
    </label>
  );

  return (
    <div className="bg-white rounded-3xl border-2 border-cream-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-sm text-gray-700">{label}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          url ? 'bg-matcha-50 text-matcha-600' : 'bg-cream-100 text-gray-400'
        }`}>
          {url ? '✓ Ada' : hint}
        </span>
      </div>

      {url ? (
        <div className="relative rounded-2xl overflow-hidden bg-cream-100">
          <img src={url} alt={label} onClick={() => onZoom(url)}
               className="w-full max-h-64 object-contain cursor-zoom-in" />
          {uploading && (
            <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
              <span className="text-sm font-bold text-matcha-700 animate-pulse">Mengunggah…</span>
            </div>
          )}
        </div>
      ) : uploading ? (
        <div className="flex flex-col items-center justify-center gap-1 h-32 rounded-2xl
                        border-2 border-dashed border-matcha-300 bg-matcha-50">
          <span className="text-3xl">⏳</span>
          <span className="text-xs font-bold text-gray-500">Mengunggah…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <PickButton camera
            className="flex flex-col items-center justify-center gap-1 h-32 rounded-2xl
                       border-2 border-dashed border-cream-300 hover:border-matcha-400
                       active:bg-cream-100 transition">
            <span className="text-3xl">📷</span>
            <span className="text-xs font-bold text-gray-500">Jepret sekarang</span>
          </PickButton>
          <PickButton
            className="flex flex-col items-center justify-center gap-1 h-32 rounded-2xl
                       border-2 border-dashed border-cream-300 hover:border-matcha-400
                       active:bg-cream-100 transition">
            <span className="text-3xl">🖼️</span>
            <span className="text-xs font-bold text-gray-500">Dari galeri</span>
          </PickButton>
        </div>
      )}

      {url && (
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onZoom(url)}
              className="text-xs font-bold py-2.5 rounded-2xl bg-cream-100 text-matcha-800
                         border-2 border-cream-300 active:translate-y-[1px]">
              👁 Lihat
            </button>
            <button onClick={onEdit} disabled={uploading}
              className="text-xs font-bold py-2.5 rounded-2xl bg-cream-100 text-matcha-800
                         border-2 border-cream-300 active:translate-y-[1px] disabled:opacity-50">
              ✂️ Atur posisi
            </button>
          </div>
          <div className="flex gap-2">
            <PickButton camera
              className="flex-1 text-xs font-bold py-2.5 rounded-2xl bg-matcha-800 text-white
                         active:translate-y-[1px]">
              📷 Jepret ulang
            </PickButton>
            <PickButton
              className="flex-1 text-xs font-bold py-2.5 rounded-2xl bg-cream-100 text-matcha-800
                         border-2 border-cream-300 active:translate-y-[1px]">
              🖼️ Galeri
            </PickButton>
            <button onClick={onRemove} disabled={uploading}
              className="px-3.5 text-xs font-bold rounded-2xl bg-berry-50 text-berry-600 disabled:opacity-50">
              Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParcelSheet({ parcel, onClose, onChanged, onToast }) {
  const [busy, setBusy] = useState('');     // slot yang sedang diunggah
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(null);
  const [preview, setPreview] = useState({}); // slot → blob URL foto yang sedang naik
  const [editorSlot, setEditorSlot] = useState(null); // slot foto yang sedang dirapikan
  // Foto yang baru dipilih ditahan dulu di editor — belum terkirim ke server
  // sampai admin menekan tombol konfirmasi. Beberapa foto memang perlu
  // diatur bingkai/posisinya dulu sebelum dilihat pelanggan.
  const [pending, setPending] = useState(null);
  const [editing, setEditing] = useState(false);
  const [codes, setCodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    recipient_name: parcel.recipient_name || '',
    tracking_number: parcel.tracking_number || '',
    estimated_quantity: parcel.estimated_quantity ?? 1,
    estimated_weight_grams: parcel.estimated_weight_grams ?? 0,
    owner_code_id: parcel.owner_code_id ? String(parcel.owner_code_id) : '',
  });

  // Kunci gulir halaman di belakang
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!editing || codes.length) return;
    fetch('/api/codes').then(r => r.json())
      .then(d => setCodes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [editing, codes.length]);

  function pickFile(slot, file, { index = null, label = 'Foto' } = {}) {
    if (!file) return;
    setPending(p => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return { slot, index, label, url: URL.createObjectURL(file) };
    });
  }

  function cancelPending() {
    setPending(p => {
      if (p?.url) URL.revokeObjectURL(p.url);
      return null;
    });
  }

  async function handleFile(slot, file, { rapi = false, index = null } = {}) {
    if (!file) return;
    setError('');
    const bk = index != null ? `extra:${index}` : slot; // kunci status sibuk/pratinjau
    setBusy(bk);
    let previewUrl = null;
    try {
      // Hasil dari editor sudah pas ukurannya, tidak perlu dikecilkan lagi
      const small = rapi ? file : await compressImage(file);

      // Tampilkan fotonya langsung, tidak menunggu upload selesai
      previewUrl = URL.createObjectURL(small);
      setPreview(p => ({ ...p, [bk]: previewUrl }));

      const send = () => {
        const fd = new FormData();
        fd.append('photo', small);
        fd.append('kind', parcel.kind);
        fd.append('id', parcel.id);
        fd.append('slot', slot);
        if (index != null) fd.append('index', index);
        return fetch('/api/photos/upload', { method: 'POST', body: fd });
      };

      // VPN sering putus di tengah jalan — coba lagi sekali sebelum menyerah
      let res;
      try { res = await send(); } catch { res = await send(); }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload gagal');

      onChanged(parcel, {
        photo_url: data.photo_url,
        co_photo_url: data.co_photo_url,
        photo_uploaded_at: data.photo_uploaded_at,
        ...(data.extra_photos !== undefined && { extra_photos: data.extra_photos }),
      });
      onToast(rapi ? '✅ Foto dirapikan' : slot === 'photo' ? '✅ Foto arrival tersimpan' : slot === 'extra' ? '✅ Foto ditambahkan ke album' : '✅ Foto CO tersimpan');
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Koneksi terputus — cek VPN lalu coba lagi' : e.message);
    } finally {
      setBusy('');
      setPreview(p => { const { [bk]: _, ...rest } = p; return rest; });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  }

  async function removePhoto(slot) {
    if (!confirm('Hapus foto ini?')) return;
    setBusy(slot);
    try {
      const res = await fetch(`/api/photos/${parcel.kind}/${parcel.id}/${slot}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      onChanged(parcel, {
        photo_url: data.photo_url,
        co_photo_url: data.co_photo_url,
        photo_uploaded_at: data.photo_uploaded_at,
        ...(data.extra_photos !== undefined && { extra_photos: data.extra_photos }),
      });
      onToast('🗑️ Foto dihapus');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function removeExtra(index) {
    if (!confirm('Hapus foto ini?')) return;
    setBusy(`extra:${index}`);
    try {
      const res = await fetch(`/api/photos/${parcel.kind}/${parcel.id}/extra/${index}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      onChanged(parcel, { extra_photos: data.extra_photos });
      onToast('🗑️ Foto album dihapus');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!form.recipient_name.trim() || !form.tracking_number.trim()) {
      setError('Nama penerima dan nomor resi wajib diisi');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        recipient_name: form.recipient_name.trim(),
        tracking_number: form.tracking_number.trim(),
        estimated_quantity: form.estimated_quantity,
        owner_code_id: form.owner_code_id,
      };
      if (parcel.kind === 'hc') body.estimated_weight_grams = form.estimated_weight_grams;

      const res = await fetch(`/api/photos/${parcel.kind}/${parcel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');

      onChanged(parcel, {
        recipient_name: data.recipient_name,
        tracking_number: data.tracking_number,
        estimated_quantity: data.estimated_quantity,
        estimated_weight_grams: data.estimated_weight_grams,
        owner_code_id: data.owner_code_id,
        owner: data.owner,
      });
      setEditing(false);
      onToast('✅ Data resi diperbarui');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="w-full sm:max-w-lg bg-cream-50 rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto animate-pop-in">

        {/* Kepala */}
        <div className={`sticky top-0 px-4 pt-3 pb-3 border-b-2 z-10 ${
          parcel.need_unboxing ? 'bg-violet-50 border-violet-200' : 'bg-cream-50 border-cream-200'
        }`}>
          <div className="w-10 h-1 bg-cream-300 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 truncate">{parcel.recipient_name || '—'}</p>
              <p className="font-mono text-[11px] text-gray-400 truncate">{parcel.tracking_number}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-cream-200 text-gray-500 flex items-center justify-center flex-shrink-0">
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {parcel.open_order != null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-matcha-800 text-white">
                🔖 Buka ke-{parcel.open_order}
              </span>
            )}
            <TypeBadge parcel={parcel} />
            {parcel.owner && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-matcha-50 text-matcha-700">
                👤 {parcel.owner.label}
              </span>
            )}
            {parcel.need_unboxing && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-600 text-white">
                🎥 Unboxing
              </span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {parcel.need_unboxing && (
            <div className="bg-violet-600 text-white rounded-3xl px-4 py-3 flex items-start gap-3">
              <span className="text-2xl leading-none">🎥</span>
              <div className="min-w-0">
                <p className="font-extrabold text-sm leading-tight">Jangan dibuka dulu!</p>
                <p className="text-[11px] text-violet-100 leading-snug mt-0.5">
                  Pelanggan minta video unboxing — rekam dulu dari paket masih tersegel,
                  baru dibuka.
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="bg-red-50 text-red-600 text-xs font-semibold px-3 py-2.5 rounded-2xl">{error}</p>
          )}

          {/* Kotak foto: arrival → foto tambahan (fitur sama) → CO */}
          {(() => {
            const slotCard = slot => (
              <PhotoCard
                key={slot.key}
                label={slot.label}
                hint={slot.hint}
                url={(busy === slot.key && preview[slot.key]) || parcel[slot.field]}
                uploading={busy === slot.key}
                onPick={f => pickFile(slot.key, f, { label: slot.label })}
                onZoom={setZoom}
                onEdit={() => setEditorSlot(slot)}
                onRemove={() => removePhoto(slot.key)}
              />
            );
            const extras = parcel.photo_url ? (parcel.extra_photos || []) : [];
            return (
              <>
                {slotCard(SLOTS[0])}

                {extras.map((u, i) => (
                  <PhotoCard
                    key={u + i}
                    label={`Foto Tambahan ${i + 1}`}
                    hint=""
                    url={(busy === `extra:${i}` && preview[`extra:${i}`]) || u}
                    uploading={busy === `extra:${i}`}
                    onPick={f => pickFile('extra', f, { index: i, label: `Foto Tambahan ${i + 1}` })}
                    onZoom={setZoom}
                    onEdit={() => setEditorSlot({ key: 'extra', index: i, url: u, label: `Foto Tambahan ${i + 1}` })}
                    onRemove={() => removeExtra(i)}
                  />
                ))}

                {/* Tambah foto lagi ke album resi ini (setelah foto arrival ada) */}
                {parcel.photo_url && extras.length < 8 && (
                  <div className="bg-white rounded-3xl border-2 border-dashed border-cream-300 p-3">
                    <p className="font-bold text-sm text-gray-700 mb-2">
                      ➕ Tambah foto {extras.length ? 'lagi' : 'tambahan'}
                      <span className="ml-1.5 text-[10px] font-semibold text-gray-400">satu album dengan foto arrival</span>
                    </p>
                    {busy === 'extra' ? (
                      <p className="text-xs font-bold text-gray-500 text-center py-3 animate-pulse">Mengunggah…</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {[true, false].map(camera => (
                          <label key={String(camera)}
                            className="cursor-pointer text-center text-xs font-bold py-3 rounded-2xl
                                       bg-cream-100 text-matcha-800 border-2 border-cream-300 active:translate-y-[1px]">
                            <input type="file" accept="image/*" className="hidden"
                              {...(camera ? { capture: 'environment' } : {})}
                              onChange={e => { handleFile('extra', e.target.files?.[0]); e.target.value = ''; }} />
                            {camera ? '📷 Jepret' : '🖼️ Dari galeri'}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {slotCard(SLOTS[1])}
              </>
            );
          })()}

          {/* Ubah data seperlunya */}
          <div className="bg-white rounded-3xl border-2 border-cream-200 overflow-hidden">
            <button onClick={() => setEditing(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left">
              <span className="font-bold text-sm text-gray-700">✏️ Ubah data resi</span>
              <span className={`text-gray-400 transition-transform ${editing ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {editing && (
              <form onSubmit={saveEdit} className="px-4 pb-4 space-y-3 border-t-2 border-cream-100 pt-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nama Penerima</label>
                  <input value={form.recipient_name} onChange={e => setField('recipient_name', e.target.value)}
                         className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nomor Resi</label>
                  <input value={form.tracking_number} onChange={e => setField('tracking_number', e.target.value)}
                         className="input-field font-mono" required />
                </div>
                <div className={parcel.kind === 'hc' ? 'grid grid-cols-2 gap-3' : ''}>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Jumlah</label>
                    <input type="number" min="1" inputMode="numeric" value={form.estimated_quantity}
                           onChange={e => setField('estimated_quantity', e.target.value)}
                           className="input-field" />
                  </div>
                  {parcel.kind === 'hc' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">Berat (g)</label>
                      <input type="number" min="0" inputMode="numeric" value={form.estimated_weight_grams}
                             onChange={e => setField('estimated_weight_grams', e.target.value)}
                             className="input-field" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Pemilik</label>
                  <select value={form.owner_code_id} onChange={e => setField('owner_code_id', e.target.value)}
                          className="input-field">
                    <option value="">— Belum ditentukan —</option>
                    {codes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>

                <button type="submit" disabled={saving} className="btn-primary w-full py-3">
                  {saving ? 'Menyimpan…' : 'Simpan perubahan'}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Biaya, denda, dan tarif tidak ikut berubah dari sini.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {zoom && (
        <div className="photo-zoom-overlay" onClick={e => { e.stopPropagation(); setZoom(null); }}>
          <img src={zoom} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {pending && (
        <PhotoEditor
          url={pending.url}
          title={`${pending.label} — atur dulu`}
          saveLabel="✓ Konfirmasi & simpan"
          onClose={cancelPending}
          onSave={async file => {
            await handleFile(pending.slot, file, { rapi: true, index: pending.index });
            cancelPending();
          }}
        />
      )}

      {editorSlot && (
        <PhotoEditor
          url={editorSlot.field ? parcel[editorSlot.field] : editorSlot.url}
          title={editorSlot.label}
          onClose={() => setEditorSlot(null)}
          onSave={async file => {
            await handleFile(editorSlot.key, file, { rapi: true, index: editorSlot.index ?? null });
            setEditorSlot(null);
          }}
        />
      )}
    </div>
  );
}
