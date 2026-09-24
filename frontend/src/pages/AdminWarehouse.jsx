import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminBoxCard from '../components/AdminBoxCard';
import AddParcelModal from '../components/AddParcelModal';
import ParcelDetailModal from '../components/ParcelDetailModal';
import LabelPrintModal from '../components/LabelPrintModal';
import LoadingSpinner from '../components/LoadingSpinner';
import Pager, { usePaged } from '../components/Pager';
import { sumParcels, formatMulti, money, baseFee, storageDays, storageTone } from '../utils/format';
import { useOpenMarks } from '../utils/openMarks';

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
  const [view, setView] = useState('list'); // list | box
  const [showForm, setShowForm] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [extraFilter, setExtraFilter] = useState('all'); // all | unboxing | freebies | manual
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);   // tambah resi dari tampilan Semua Resi
  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(new Set()); // resi tercentang di tabel
  const [labelTargets, setLabelTargets] = useState(null);
  const searchRef = useRef(null);

  // Penanda urutan bongkar paket — lihat utils/openMarks.js
  const allParcels = useMemo(
    () => [...boxes.flatMap(b => b.parcels || []), ...unassigned],
    [boxes, unassigned]
  );
  const openMarks = useOpenMarks(allParcels);

  // Resi yang diketik admin tapi pemiliknya belum ditentukan — ini yang
  // muncul sebagai "resi nyasar" di panel pelanggan
  const manualUnowned = useMemo(
    () => allParcels.filter(p => p.is_manual_input && !p.owner_code_id),
    [allParcels]
  );

  // Tekan "/" di mana saja untuk langsung mengetik di kolom cari
  useEffect(() => {
    function onKey(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        if (extraFilter === 'unboxing' && !p.need_unboxing) return false;
        if (extraFilter === 'freebies' && !p.freebies_stay) return false;
        if (extraFilter === 'manual' && !p.is_manual_input) return false;
        if (q) {
          const hay = [p.tracking_number, p.recipient_name, p.owner?.label, p.box?.name]
            .filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [boxes, unassigned, search, ownerFilter, showClosed, extraFilter]);

  const listPaged = usePaged(flat, pageSize);

  function toggleSel(id) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Centang semua yang sedang tampil di halaman ini
  function togglePage() {
    const ids = listPaged.items.map(p => p.id);
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const n = new Set(prev);
      ids.forEach(id => (allOn ? n.delete(id) : n.add(id)));
      return n;
    });
  }

  const picked = flat.filter(p => selected.has(p.id));
  // Pindah massal hanya masuk akal kalau semuanya milik pelanggan yang sama
  const pickedOwnerId = picked.length && picked.every(p => String(p.owner?.id) === String(picked[0].owner?.id))
    ? picked[0].owner?.id : null;

  async function moveSelected(boxId) {
    if (!boxId || !picked.length) return;
    await fetch('/api/boxes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcel_ids: picked.map(p => p.id), box_id: boxId }),
    });
    setSelected(new Set());
    load();
  }

  async function removeParcel(id) {
    if (!window.confirm('Hapus resi ini?')) return;
    const res = await fetch(`/api/parcels/wh/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

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
        <button
          onClick={() => setAdding(true)}
          className="ml-auto text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 text-white
                     border border-slate-800 hover:bg-slate-700 transition-colors"
          title="Tambah resi tanpa harus masuk ke box dulu"
        >
          + Tambah Resi
        </button>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
            showForm ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
          }`}
        >
          {showForm ? 'Tutup form' : '+ Box baru'}
        </button>
      </div>

      {/* Buat box */}
      {showForm && (
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
      )}

      {/* Cari & saring — menempel di atas saat daftar digulir */}
      <div className="sticky top-0 z-20 -mx-5 md:-mx-7 px-5 md:px-7 py-3 mb-3 bg-cream-100/95 backdrop-blur border-b border-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
            placeholder="Cari nomor resi, penerima, pelanggan, atau box...  ( / )"
            className="input-field text-sm py-2 pl-9 pr-8"
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
        <select value={extraFilter} onChange={e => setExtraFilter(e.target.value)}
          className="input-field text-sm py-2 w-auto">
          <option value="all">Semua permintaan</option>
          <option value="unboxing">🎥 Video unboxing</option>
          <option value="freebies">🎁 Freebies tinggal</option>
          <option value="manual">✍️ Input manual</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)}
            className="accent-slate-700" />
          Termasuk box tertutup
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

      {/* Ringkasan hasil pencarian — langsung terlihat tanpa menggulir */}
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
        <span>
          {view === 'list'
            ? `${flat.length} resi ditemukan`
            : `${shown.length} box ditemukan`}
        </span>
        {(search || ownerFilter !== 'all' || extraFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setOwnerFilter('all'); setExtraFilter('all'); }}
            className="text-slate-500 hover:text-slate-800 underline">
            Reset pencarian
          </button>
        )}
        {view === 'list' && (
          <label className="ml-auto flex items-center gap-1.5">
            Tampil
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-1.5 py-0.5 bg-white">
              {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            per halaman
          </label>
        )}
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

      {/* Aksi untuk resi tercentang */}
      {view === 'list' && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-800 text-white rounded-xl px-3 py-2 mb-3">
          <span className="text-xs font-semibold">{selected.size} resi dipilih</span>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-white/70 hover:text-white underline">Batal pilih</button>
          <div className="flex-1" />
          {pickedOwnerId && (
            <select
              value=""
              onChange={e => { moveSelected(e.target.value); e.target.value = ''; }}
              className="text-xs rounded-lg px-2 py-1.5 text-slate-700"
              title="Pindahkan semua resi terpilih ke box"
            >
              <option value="">Pindahkan ke box...</option>
              {openBoxes
                .filter(b => String(b.owner?.id) === String(pickedOwnerId))
                .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setLabelTargets(picked)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-slate-800 hover:bg-slate-100"
          >
            🏷 Cetak Label ({selected.size})
          </button>
        </div>
      )}

      {/* Resi ketikan tangan yang belum ada pemiliknya */}
      {view === 'list' && manualUnowned.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200">
          <span className="text-base leading-none">🔔</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-rose-900">
              {manualUnowned.length} resi input manual belum ada pemiliknya
            </p>
            <p className="text-[11px] text-rose-700/80">
              Pelanggan sudah melihat daftarnya di panel masing-masing untuk diklaim
            </p>
          </div>
          <div className="flex-1" />
          <button onClick={() => setExtraFilter('manual')}
            className="text-[11px] font-semibold text-rose-800 hover:text-rose-950 underline whitespace-nowrap">
            Lihat resinya
          </button>
        </div>
      )}

      {/* Ringkasan penanda bongkar */}
      {view === 'list' && openMarks.count > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-base leading-none">🔖</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-900">
              {openMarks.count} resi ditandai dibuka · berikutnya nomor {openMarks.nextNumber}
            </p>
            <p className="text-[11px] text-amber-700/80">
              Nomor hilang sendiri setelah label dicetak dan foto arrival masuk
            </p>
          </div>
          <div className="flex-1" />
          <button onClick={openMarks.clearAll}
            className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline whitespace-nowrap">
            Reset semua
          </button>
        </div>
      )}

      {/* Semua resi dalam bentuk tabel */}
      {view === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 border-b border-slate-200">
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={listPaged.items.length > 0 && listPaged.items.every(p => selected.has(p.id))}
                      onChange={togglePage}
                      className="accent-slate-700 cursor-pointer"
                      title="Pilih semua di halaman ini"
                    />
                  </th>
                  <th className="px-3 py-2 text-left w-10">No</th>
                  <th className="px-3 py-2 text-center w-16" title="Urutan paket dibuka — untuk mencocokkan foto arrival">Buka</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Penerima</th>
                  <th className="px-3 py-2 text-left w-14">Foto</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-left">Permintaan</th>
                  <th className="px-3 py-2 text-right">Jumlah</th>
                  <th className="px-3 py-2 text-right">Fee WH</th>
                  <th className="px-3 py-2 text-right">Durasi</th>
                  <th className="px-3 py-2 text-left w-40">Box</th>
                  <th className="px-3 py-2 text-right w-20">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {listPaged.items.map((p, i) => {
                  const days = storageDays(p, p.box?.closed_at);
                  return (
                    <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${
                      selected.has(p.id) ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSel(p.id)}
                          className="accent-slate-700 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-400">{listPaged.from + i}</td>
                      <td className="px-3 py-2 text-center">
                        <OpenMarkCell parcel={p} marks={openMarks} />
                      </td>
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
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {p.need_unboxing && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 text-white whitespace-nowrap"
                              title="Pelanggan minta video unboxing">🎥 Unboxing</span>
                          )}
                          {p.freebies_stay && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 whitespace-nowrap"
                              title="Freebies ditinggal di gudang">🎁 Freebies</span>
                          )}
                          {p.is_manual_input && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap"
                              title="Resi diketik manual">✍️ Manual</span>
                          )}
                          {!p.need_unboxing && !p.freebies_stay && !p.is_manual_input && (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
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
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setLabelTargets([p])} title="Cetak label resi ini"
                          className="text-slate-400 hover:text-slate-700 px-1">🏷</button>
                        <button onClick={() => setDetail(p)} title="Lihat detail"
                          className="text-slate-400 hover:text-slate-700 px-1">👁</button>
                        <button onClick={() => setEditing(p)} title="Edit resi"
                          className="text-slate-400 hover:text-slate-700 px-1">✏️</button>
                        <button onClick={() => removeParcel(p.id)} title="Hapus resi"
                          className="text-slate-400 hover:text-red-600 px-1">🗑</button>
                      </td>
                    </tr>
                  );
                })}
                {listPaged.items.length === 0 && (
                  <tr><td colSpan="13" className="px-3 py-12 text-center text-slate-400">
                    {search ? `Tidak ada resi untuk "${search}"` : 'Belum ada resi'}
                  </td></tr>
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

      {labelTargets && (
        <LabelPrintModal
          parcels={labelTargets}
          onPrinted={openMarks.markPrinted}
          type="WH"
          onClose={() => setLabelTargets(null)}
        />
      )}

      {adding && (
        <AddParcelModal
          type="WH"
          batchId={tarif?.batchId}
          boxId=""
          boxName="Resi baru — box bisa dipilih di tabel setelah tersimpan"
          feePerGram={tarif?.fee_per_gram || 0}
          feeCurrency={tarif?.fee_currency || 'CNY'}
          fineAmount={Number(tarif?.fine_amount ?? 2000)}
          unboxingFee={Number(tarif?.unboxing_fee ?? 0.75)}
          unitFee={Number(tarif?.unit_fee ?? 1.5)}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); load(); }}
        />
      )}

      {editing && (
        <AddParcelModal
          type="WH"
          parcel={editing}
          boxId={editing.box_id ?? ''}
          boxName={editing.box ? `${editing.owner?.label || '—'} - ${editing.box.name}` : 'Tanpa box'}
          feePerGram={tarif?.fee_per_gram || 0}
          feeCurrency={tarif?.fee_currency || 'CNY'}
          fineAmount={Number(tarif?.fine_amount ?? 2000)}
          unboxingFee={Number(tarif?.unboxing_fee ?? 0.75)}
          unitFee={Number(tarif?.unit_fee ?? 1.5)}
          onClose={() => setEditing(null)}
          onEdited={() => { setEditing(null); load(); }}
        />
      )}

      {detail && (
        <ParcelDetailModal parcel={detail} type="WH" isAdmin onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

// ── Penanda urutan bongkar paket ────────────────────────────────────
//  Satu kolom kecil di tabel: klik "+" saat paket dibuka, nomornya dipakai
//  untuk mencocokkan foto arrival. Dua titik di bawah nomor menunjukkan apa
//  yang masih kurang — label dan foto — karena begitu keduanya beres,
//  nomornya hilang sendiri.
function OpenMarkCell({ parcel, marks }) {
  const mark = marks.get(parcel.id);

  if (!mark) {
    return (
      <button
        onClick={() => marks.mark(parcel.id)}
        title={`Tandai sebagai paket ke-${marks.nextNumber} yang dibuka`}
        className="w-7 h-7 rounded-lg border border-dashed border-slate-300 text-slate-300
                   hover:border-slate-500 hover:text-slate-600 hover:bg-slate-50 transition-colors"
      >
        +
      </button>
    );
  }

  const hasPhoto = !!parcel.photo_url;
  const dot = (on, label) => (
    <span title={label}
      className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-500' : 'bg-slate-200'}`} />
  );

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <button
        onClick={() => marks.unmark(parcel.id)}
        title={`Paket ke-${mark.order} yang dibuka — klik untuk membatalkan tanda`}
        className="w-7 h-7 rounded-lg bg-slate-800 text-white text-xs font-bold
                   hover:bg-red-600 transition-colors"
      >
        {mark.order}
      </button>
      <span className="flex gap-1 items-center">
        {dot(mark.printed, mark.printed ? 'Label sudah dicetak' : 'Label belum dicetak')}
        {dot(hasPhoto, hasPhoto ? 'Foto arrival sudah ada' : 'Foto arrival belum ada')}
      </span>
    </div>
  );
}
