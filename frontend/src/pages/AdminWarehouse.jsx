import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminBoxCard from '../components/AdminBoxCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Pager, { usePaged } from '../components/Pager';
import { sumParcels, formatMulti, money, baseFee, storageDays, storageTone } from '../utils/format';

export default function AdminWarehouse() {
  const [boxes, setBoxes] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [codes, setCodes] = useState([]);
  const [tarif, setTarif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showClosed, setShowClosed] = useState(false);
  const [form, setForm] = useState({ owner_code_id: '', name: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [view, setView] = useState('box'); // box | list

  const load = useCallback(async () => {
    const [data, c, batch] = await Promise.all([
      fetch('/api/parcels/wh/boxes').then(r => r.json()),
      fetch('/api/codes').then(r => r.json()),
      fetch('/api/batches/active/WH').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    setBoxes(data.boxes || []);
    setUnassigned(data.unassigned || []);
    setCodes(Array.isArray(c) ? c : []);
    // Batch WH tidak ditampilkan lagi, tapi tarif & id-nya masih dipakai
    // di belakang layar supaya data lama tetap utuh
    if (batch) setTarif({ batchId: batch.id, ...batch });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBox(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal membuat box'); return; }
      setForm(f => ({ ...f, name: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveUnassigned() {
    if (!moveTo) return;
    const ids = unassigned.map(p => p.id);
    if (!window.confirm(`Pindahkan ${ids.length} resi tanpa box ke box terpilih?`)) return;
    await fetch('/api/boxes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_ids: ids, box_id: moveTo }),
    });
    setMoveTo('');
    load();
  }

  const owners = useMemo(() => {
    const map = new Map();
    for (const b of boxes) if (b.owner && !map.has(String(b.owner.id))) map.set(String(b.owner.id), b.owner);
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'id'));
  }, [boxes]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boxes.filter(b => {
      if (!showClosed && b.status !== 'open') return false;
      if (ownerFilter !== 'all' && String(b.owner?.id) !== ownerFilter) return false;
      if (q) {
        const hay = [b.name, b.owner?.label, b.owner?.code,
          ...(b.parcels || []).flatMap(p => [p.tracking_number, p.recipient_name])]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [boxes, search, ownerFilter, showClosed]);

  // Semua resi WH jadi satu daftar; box asalnya ikut menempel
  const flat = useMemo(() => {
    const rows = [
      ...boxes.flatMap(b => (b.parcels || []).map(p => ({ ...p, box: b }))),
      ...unassigned.map(p => ({ ...p, box: null })),
    ];
    const q = search.trim().toLowerCase();
    return rows
      .filter(p => {
        if (ownerFilter !== 'all' && String(p.owner?.id) !== ownerFilter) return false;
        if (!showClosed && p.box && p.box.status !== 'open') return false;
        if (q) {
          const hay = [p.tracking_number, p.recipient_name, p.owner?.label, p.box?.name]
            .filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [boxes, unassigned, search, ownerFilter, showClosed]);

  const listPaged = usePaged(flat, 10);

  // Pindahkan satu resi ke box lain langsung dari tabel
  async function moveOne(parcelId, boxId) {
    await fetch('/api/boxes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_ids: [parcelId], box_id: boxId || null }),
    });
    load();
  }

  const openBoxes = boxes.filter(b => b.status === 'open');
  const totals = sumParcels(openBoxes.flatMap(b => b.parcels || []), 'WH');

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      {/* Judul */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">🏭</span>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Warehouse</h1>
          <p className="text-sm text-slate-500">
            {openBoxes.length} box aktif · {totals.count} resi · {formatMulti(totals)}
          </p>
        </div>
      </div>

      {/* Buat box */}
      <form onSubmit={createBox} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-4">
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Pelanggan</label>
            <select className="input-field text-sm py-2" value={form.owner_code_id} required
              onChange={e => setForm(f => ({ ...f, owner_code_id: e.target.value }))}>
              <option value="">— pilih —</option>
              {codes.filter(c => c.access_wh ?? true).map(c => (
                <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Nama box</label>
            <input className="input-field text-sm py-2" value={form.name} required placeholder="Box 1 / Box A"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <button type="submit" disabled={busy} className="btn-primary text-sm py-2 disabled:opacity-50">+ Box</button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">⚠️ {error}</p>}
      </form>

      {/* Cari & saring */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari box, pelanggan, atau nomor resi..."
            className="input-field text-sm py-2 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
          )}
        </div>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
          className="input-field text-sm py-2 w-auto">
          <option value="all">Semua pelanggan</option>
          {owners.map(o => <option key={o.id} value={String(o.id)}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)}
            className="accent-slate-700" />
          Tampilkan box tertutup
        </label>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-0.5">
          {[['box', 'Per Box'], ['list', 'Semua Resi']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                view === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Resi yang belum punya box */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-amber-800">{unassigned.length} resi belum masuk box</p>
          <p className="text-xs text-amber-700 mt-0.5 mb-2">
            Resi lama dari sistem batch. Pilih box tujuan untuk memindahkan semuanya sekaligus.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={moveTo} onChange={e => setMoveTo(e.target.value)} className="input-field text-sm py-1.5 w-auto">
              <option value="">— pilih box tujuan —</option>
              {openBoxes.map(b => (
                <option key={b.id} value={b.id}>{b.owner?.label} - {b.name}</option>
              ))}
            </select>
            <button onClick={moveUnassigned} disabled={!moveTo}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-amber-600 text-white disabled:opacity-40">
              Pindahkan semua
            </button>
          </div>
        </div>
      )}

      {/* Semua resi dalam bentuk tabel */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left w-10">No</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Penerima</th>
                  <th className="px-3 py-2 text-left w-14">Foto</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-right">Jumlah</th>
                  <th className="px-3 py-2 text-right">Fee WH</th>
                  <th className="px-3 py-2 text-right">Durasi</th>
                  <th className="px-3 py-2 text-left w-40">Box</th>
                </tr>
              </thead>
              <tbody>
                {listPaged.items.map((p, i) => {
                  const days = storageDays(p, p.box?.closed_at);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-3 py-2 text-slate-400">{listPaged.from + i}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{p.owner?.label || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="text-slate-700 truncate max-w-[140px]">{p.recipient_name}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">{p.tracking_number}</div>
                      </td>
                      <td className="px-3 py-2">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {p.type === 'paperbased' ? 'Paperbased' : 'Barang'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{p.estimated_quantity || 1}</td>
                      <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">
                        {baseFee(p, 'WH') > 0 ? money(baseFee(p, 'WH'), p.currency) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {days ? (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${storageTone(days)}`}>
                            Hari ke-{days}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={p.box_id || ''}
                          onChange={e => moveOne(p.id, e.target.value)}
                          disabled={!p.owner}
                          title={p.owner ? 'Pindahkan resi ini ke box lain' : 'Resi tanpa pemilik belum bisa dimasukkan ke box'}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">— tanpa box —</option>
                          {openBoxes
                            .filter(b => String(b.owner?.id) === String(p.owner?.id))
                            .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          {p.box && p.box.status !== 'open' && (
                            <option value={p.box.id}>{p.box.name} (ditutup)</option>
                          )}
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {listPaged.items.length === 0 && (
                  <tr><td colSpan="9" className="px-3 py-10 text-center text-slate-400">Tidak ada resi yang cocok</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager paged={listPaged} className="px-3 py-2.5 border-t border-slate-100" />
        </div>
      )}

      {/* Daftar box */}
      {view === 'box' && (loading ? (
        <LoadingSpinner text="Memuat box..." />
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          {boxes.length === 0 ? 'Belum ada box. Buat box pertama lewat form di atas.' : 'Tidak ada box yang cocok.'}
        </div>
      ) : (
        shown.map(b => (
          <AdminBoxCard
            key={b.id}
            box={b}
            tarif={tarif}
            onChanged={load}
            onParcelsChanged={load}
          />
        ))
      ))}
    </div>
  );
}
