import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Checklist packing: menandai resi yang barangnya sudah masuk ke box.
//
// Dipakai sambil memasukkan barang ke kardus, sering lewat ponsel dan satu
// tangan. Karena itu barisnya besar, yang belum masuk ditaruh di atas, dan
// ada kotak ketik cepat: ketik beberapa angka terakhir resinya lalu Enter —
// langsung tercentang tanpa perlu mencari-cari di daftar.
export default function PackChecklist({ boxId, onClose, onChanged }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [ketik, setKetik]   = useState('');
  const [kabar, setKabar]   = useState(null);   // { ok, teks }
  const [sibuk, setSibuk]   = useState(false);
  const kotak = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/boxes/${boxId}/packlist`).then(r => r.json());
      setData(d);
      setError(d.ready === false ? d.error : '');
    } catch {
      setError('Gagal memuat daftar isi box');
    }
    setLoading(false);
  }, [boxId]);

  useEffect(() => { load(); }, [load]);

  const parcels = data?.parcels || [];
  const sudah = parcels.filter(p => p.packed_at);
  const belum = parcels.filter(p => !p.packed_at);
  const persen = parcels.length ? Math.round((sudah.length / parcels.length) * 100) : 0;

  // Yang belum masuk di atas — itu yang sedang dicari di meja packing
  const urut = useMemo(
    () => [...belum, ...sudah.slice().reverse()],
    [parcels] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function tandai(ids, masuk) {
    if (!ids.length) return;
    setSibuk(true);
    // Centangnya terasa langsung; kalau gagal, daftarnya dimuat ulang
    setData(d => ({
      ...d,
      parcels: d.parcels.map(p =>
        ids.includes(p.id) ? { ...p, packed_at: masuk ? new Date().toISOString() : null } : p),
    }));
    try {
      const res = await fetch(`/api/boxes/${boxId}/pack`, {
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

  // Ketik cepat: cocokkan dengan potongan nomor resi
  function ketikMasuk(e) {
    e.preventDefault();
    const q = ketik.trim().toLowerCase();
    if (!q) return;

    const cocok = parcels.filter(p => String(p.tracking_number).toLowerCase().includes(q));
    if (!cocok.length) {
      setKabar({ ok: false, teks: `Tidak ada resi yang mengandung "${ketik}" di box ini` });
    } else if (cocok.length > 1) {
      setKabar({ ok: false, teks: `${cocok.length} resi cocok dengan "${ketik}" — ketik lebih panjang` });
    } else if (cocok[0].packed_at) {
      setKabar({ ok: false, teks: `${cocok[0].tracking_number} sudah dicentang sebelumnya` });
    } else {
      tandai([cocok[0].id], true);
      setKabar({ ok: true, teks: `✓ ${cocok[0].tracking_number} masuk box` });
    }
    setKetik('');
    kotak.current?.focus();
    setTimeout(() => setKabar(null), 2500);
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
                {data?.box ? `${data.box.owner?.label || '—'} · ${data.box.name}` : 'Memuat…'}
              </p>
            </div>
            <button onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
              ×
            </button>
          </div>

          {/* Kemajuan */}
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

        {/* Ketik cepat */}
        {!!parcels.length && (
          <form onSubmit={ketikMasuk} className="px-5 py-3 border-b border-cream-100 flex gap-2">
            <input
              ref={kotak} value={ketik} onChange={e => setKetik(e.target.value)}
              placeholder="Ketik akhiran nomor resi lalu Enter…"
              className="flex-1 min-w-0 border border-cream-300 rounded-xl px-3 py-2 text-sm font-mono"
            />
            <button type="submit" disabled={!ketik.trim()}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-40">
              Centang
            </button>
          </form>
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
            <p className="text-sm text-gray-400 text-center py-6">Memuat isi box…</p>
          ) : !parcels.length ? (
            <p className="text-sm text-gray-400 text-center py-6">Box ini belum ada isinya</p>
          ) : urut.map(p => (
            <label key={p.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                p.packed_at
                  ? 'border-green-200 bg-green-50/70'
                  : 'border-cream-200 bg-white hover:border-matcha-300'
              }`}>
              <input
                type="checkbox" checked={!!p.packed_at}
                onChange={() => tandai([p.id], !p.packed_at)}
                className="w-5 h-5 accent-matcha-700 flex-shrink-0"
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
            </label>
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
