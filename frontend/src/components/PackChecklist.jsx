import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Checklist packing untuk satu permintaan tutup box.
//
// Daftarnya persis resi yang diminta pelanggan, jadi yang dicentang =
// barangnya sudah masuk kardus. Kalau ada yang ternyata tidak ketemu,
// resinya dikeluarkan dari permintaan — dengan begitu tagihan yang dicetak
// nanti cocok dengan yang benar-benar dikirim.
//
// Dipakai sambil packing, sering lewat ponsel dan satu tangan: barisnya
// besar, yang belum masuk ditaruh di atas, dan kotak cari di atasnya bisa
// langsung mencentang kalau hasilnya tinggal satu.
export default function PackChecklist({
  requestId,          // dipakai dari Req Close Box: ✕ mengeluarkan dari permintaan
  parcelIds,          // dipakai dari Invoice: daftar resi yang mau ditagih
  judul,              // keterangan kecil di bawah judul
  onDrop,             // ✕ waktu memakai parcelIds — diurus pemanggilnya
  onClose,
  onChanged,
}) {
  const lewatPermintaan = !!requestId;
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [cari, setCari]       = useState('');
  const [kabar, setKabar]     = useState(null);   // { ok, teks }
  const [sibuk, setSibuk]     = useState(false);
  const kotak = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = lewatPermintaan
        ? await fetch(`/api/box-requests/${requestId}/packlist`).then(r => r.json())
        : await fetch('/api/parcels/packlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: parcelIds || [] }),
          }).then(r => r.json());
      setData(d);
      setError(d.ready === false ? d.error : '');
    } catch {
      setError('Gagal memuat daftar packing');
    }
    setLoading(false);
    // daftar resinya ikut berubah kalau centang tagihnya diubah
  }, [requestId, lewatPermintaan, JSON.stringify(parcelIds || [])]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const parcels = data?.parcels || [];
  const sudah = parcels.filter(p => p.packed_at);
  const belum = parcels.filter(p => !p.packed_at);
  const persen = parcels.length ? Math.round((sudah.length / parcels.length) * 100) : 0;

  const q = cari.trim().toLowerCase();
  const cocok = useMemo(() => !q ? parcels : parcels.filter(p =>
    String(p.tracking_number).toLowerCase().includes(q) ||
    String(p.recipient_name || '').toLowerCase().includes(q)
  ), [parcels, q]);

  // Yang belum masuk di atas — itu yang sedang dicari di meja packing
  const urut = useMemo(() => {
    const b = cocok.filter(p => !p.packed_at);
    const s = cocok.filter(p => p.packed_at);
    return [...b, ...s];
  }, [cocok]);

  function lapor(ok, teks) {
    setKabar({ ok, teks });
    setTimeout(() => setKabar(null), 2500);
  }

  async function tandai(ids, masuk) {
    if (!ids.length) return;
    setSibuk(true);
    setData(d => ({                        // centangnya terasa langsung
      ...d,
      parcels: d.parcels.map(p =>
        ids.includes(p.id) ? { ...p, packed_at: masuk ? new Date().toISOString() : null } : p),
    }));
    try {
      const res = await fetch(lewatPermintaan ? `/api/box-requests/${requestId}/pack` : '/api/parcels/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, packed: masuk }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal menyimpan'); }
      onChanged?.();
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setSibuk(false);
    }
  }

  // Barangnya tidak ketemu → keluarkan dari daftar
  async function keluarkan(p) {
    if (!lewatPermintaan) {
      if (!window.confirm(
        `Keluarkan ${p.tracking_number} dari daftar yang ditagih?\n\n`
        + 'Centang tagihnya dilepas, resinya sendiri tidak diapa-apakan.'
      )) return;
      onDrop?.(p);
      lapor(true, `${p.tracking_number} tidak ikut ditagih`);
      setData(d => ({ ...d, parcels: d.parcels.filter(x => x.id !== p.id) }));
      return;
    }

    if (!window.confirm(
      `Keluarkan ${p.tracking_number} dari permintaan ini?\n\n`
      + 'Resinya tetap ada di box dan bisa ikut kiriman berikutnya — cuma tidak ikut '
      + 'yang ini, jadi tagihannya nanti cocok dengan yang benar-benar dikirim.'
    )) return;

    setSibuk(true);
    try {
      const res = await fetch(`/api/box-requests/${requestId}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [p.id] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal mengeluarkan'); }
      lapor(true, `${p.tracking_number} dikeluarkan dari permintaan`);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSibuk(false);
    }
  }

  // Enter di kotak cari: kalau tinggal satu hasil, langsung dicentang
  function cariMasuk(e) {
    e.preventDefault();
    if (!q) return;
    if (!cocok.length) return lapor(false, `Tidak ada resi "${cari}" di daftar ini`);
    if (cocok.length > 1) return lapor(false, `${cocok.length} resi cocok — ketik lebih panjang`);
    if (cocok[0].packed_at) return lapor(false, `${cocok[0].tracking_number} sudah dicentang`);

    tandai([cocok[0].id], true);
    lapor(true, `✓ ${cocok[0].tracking_number} masuk box`);
    setCari('');
    kotak.current?.focus();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-matcha-800">📦 Checklist Packing</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {judul
                  || (data?.request
                    ? `${data.request.owner?.label || '—'} · ${data.request.box?.name || 'tanpa box'} · permintaan tutup box`
                    : 'Memuat…')}
              </p>
            </div>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
              ×
            </button>
          </div>

          {!!parcels.length && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-matcha-800">{sudah.length} / {parcels.length} masuk box</span>
                {belum.length > 0
                  ? <span className="text-amber-700">· {belum.length} belum</span>
                  : <span className="text-green-600 font-semibold">· semua sudah masuk 🎉</span>}
              </div>
              <div className="h-2 bg-white rounded-full mt-1.5 overflow-hidden border border-cream-200">
                <div className="h-full bg-matcha-600 transition-all duration-300" style={{ width: `${persen}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Cari — sekaligus centang cepat */}
        {!!parcels.length && (
          <form onSubmit={cariMasuk} className="px-5 py-3 border-b border-cream-100 flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                ref={kotak} value={cari} onChange={e => setCari(e.target.value)}
                placeholder="Cari nomor resi / nama…"
                className="w-full border border-cream-300 rounded-xl px-3 py-2 text-sm font-mono pr-7"
              />
              {cari && (
                <button type="button" onClick={() => setCari('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
                  ×
                </button>
              )}
            </div>
            <button type="submit" disabled={!q}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
              Centang
            </button>
          </form>
        )}

        {!!parcels.length && (
          <p className="px-5 pt-2 text-[11px] text-gray-400 leading-snug">
            Centang kalau barangnya sudah masuk kardus. Tombol <b>✕</b> untuk resi yang
            barangnya tidak ketemu — {lewatPermintaan
              ? 'keluar dari kiriman ini, tetap aman di boxnya.'
              : 'centang tagihnya dilepas, resinya tidak diapa-apakan.'}
          </p>
        )}

        {kabar && (
          <p className={`px-5 py-2 text-xs font-semibold ${
            kabar.ok ? 'text-green-700 bg-green-50' : 'text-amber-800 bg-amber-50'
          }`}>
            {kabar.teks}
          </p>
        )}
        {error && <p className="px-5 py-2 text-xs text-red-600 font-semibold">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Memuat daftar…</p>
          ) : !parcels.length ? (
            <p className="text-sm text-gray-400 text-center py-6">Permintaan ini sudah tidak ada isinya</p>
          ) : !urut.length ? (
            <p className="text-sm text-gray-400 text-center py-6">Tidak ada yang cocok dengan “{cari}”</p>
          ) : urut.map(p => (
            <div key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                p.packed_at
                  ? 'border-green-200 bg-green-50/70'
                  : 'border-cream-200 bg-white hover:border-matcha-300'
              }`}>
              <input
                type="checkbox" checked={!!p.packed_at}
                onChange={() => tandai([p.id], !p.packed_at)}
                className="w-6 h-6 accent-matcha-700 flex-shrink-0 cursor-pointer"
                title="Barangnya sudah masuk box"
              />
              <div className="min-w-0 flex-1">
                <p className={`font-mono text-xs font-bold truncate ${
                  p.packed_at ? 'text-green-800 line-through' : 'text-gray-700'
                }`}>
                  {p.tracking_number}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {p.recipient_name}
                  {p.type === 'paperbased' ? ' · Paperbased' : ' · Barang'}
                  {p.estimated_quantity > 1 ? ` · ${p.estimated_quantity} pcs` : ''}
                </p>
              </div>
              {!p.photo_url && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  tanpa foto
                </span>
              )}
              {/* Dipakai juga lewat ponsel, jadi bidang ketuknya dibuat
                  selebar jempol walau tandanya cuma ✕ */}
              <button
                onClick={() => keluarkan(p)} disabled={sibuk}
                title="Barangnya tidak ada — keluarkan dari permintaan ini"
                aria-label={`Keluarkan ${p.tracking_number} — barangnya tidak ada`}
                className="w-11 h-11 flex items-center justify-center rounded-full border border-cream-300
                           bg-white text-gray-400 text-lg leading-none flex-shrink-0 transition-colors
                           hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-cream-200 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => tandai(belum.map(p => p.id), true)}
            disabled={sibuk || !belum.length}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
            Centang semua sisanya ({belum.length})
          </button>
          <button
            onClick={() => tandai(sudah.map(p => p.id), false)}
            disabled={sibuk || !sudah.length}
            className="btn-secondary text-sm px-3 py-2 disabled:opacity-40">
            Kosongkan
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Tutup</button>
        </div>
      </div>
    </div>
  );
}
