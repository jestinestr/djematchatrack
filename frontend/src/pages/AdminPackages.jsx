import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate, money } from '../utils/format';

// Paket standar — klik untuk mengisi form otomatis
const PRESETS = [
  { name: 'Paket A', quota: 50, price: 65 },
  { name: 'Paket B', quota: 125, price: 140 },
  { name: 'Paket C', quota: 400, price: 425 },
];

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ owner_code_id: '', name: 'Paket A', quota: '50', price: '65', include_existing: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    const [p, c] = await Promise.all([
      fetch('/api/packages').then(r => r.json()),
      fetch('/api/codes').then(r => r.json()),
    ]);
    setPackages(Array.isArray(p) ? p : []);
    setCodes(Array.isArray(c) ? c : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const active = packages.filter(p => p.status === 'active');
  const closed = packages.filter(p => p.status !== 'active');
  // Pelanggan WH yang belum punya paket aktif (kandidat paket baru)
  const free = useMemo(() => codes.filter(c =>
    (c.access_wh ?? true) && !active.some(p => String(p.owner_code_id) === String(c.id))
  ), [codes, active]);

  async function call(url, body, key) {
    setBusy(key);
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal'); return false; }
      await load();
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function create(e) {
    e.preventDefault();
    if (await call('/api/packages', form, 'create')) {
      setForm(f => ({ ...f, owner_code_id: '', include_existing: false }));
    }
  }

  async function renew(p) {
    const q = window.prompt(
      `Perpanjang ${p.name} milik ${p.owner?.label} ke periode ${p.period_no + 1}.\n` +
      (p.overflow ? `${p.overflow} resi kelebihan akan dipindah ke periode baru.\n` : '') +
      '\nKuota periode baru:',
      String(p.quota)
    );
    if (q === null) return;
    const res = await call(`/api/packages/${p.id}/renew`, { quota: q, move_overflow: true }, p.id);
    if (res?.moved) window.alert(`${res.moved} resi kelebihan sudah pindah ke periode ${p.period_no + 1}.`);
  }

  async function close(p) {
    if (!window.confirm(`Tutup ${p.name} milik ${p.owner?.label}? Resi berikutnya dihitung satuan.`)) return;
    await call(`/api/packages/${p.id}/close`, {}, p.id);
  }

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">📦</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Paket Pelanggan</h1>
          <p className="text-sm text-gray-500">Resi dalam kuota tercover paket (biaya ¥0); kelebihan &amp; pelanggan tanpa paket otomatis satuan</p>
        </div>
      </div>

      {/* Buat paket */}
      <form onSubmit={create} className="bg-white rounded-2xl border border-cream-200 shadow-soft p-4 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1">Isi cepat</span>
          {PRESETS.map(p => (
            <button key={p.name} type="button"
              onClick={() => setForm(f => ({ ...f, name: p.name, quota: String(p.quota), price: String(p.price) }))}
              className={`text-xs px-2.5 py-1 rounded-lg font-semibold border-2 transition-colors ${
                form.name === p.name && Number(form.quota) === p.quota
                  ? 'bg-matcha-800 text-white border-matcha-800'
                  : 'bg-white text-gray-600 border-cream-300 hover:border-matcha-300'
              }`}>
              {p.name} · ¥{p.price}/{p.quota}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-1">Tanpa paket = satuan (tarif di Control Tarif)</span>
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_80px_90px_auto] gap-2 items-end">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Pelanggan</label>
            <select className="input-field text-sm py-2" value={form.owner_code_id} required
              onChange={e => setForm(f => ({ ...f, owner_code_id: e.target.value }))}>
              <option value="">— pilih —</option>
              {free.map(c => <option key={c.id} value={c.id}>{c.label} ({c.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nama paket</label>
            <input className="input-field text-sm py-2" value={form.name} required
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Kuota</label>
            <input type="number" min="1" className="input-field text-sm py-2" value={form.quota} required
              onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Harga ¥</label>
            <input type="number" min="0" step="0.01" className="input-field text-sm py-2" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <button type="submit" disabled={busy === 'create'} className="btn-primary text-sm py-2 disabled:opacity-50">
            + Buat
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={form.include_existing} className="accent-matcha-700"
            onChange={e => setForm(f => ({ ...f, include_existing: e.target.checked }))} />
          Hitung juga resi WH pelanggan ini yang sudah ada tapi belum masuk paket
        </label>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">⚠️ {error}</p>}

      {/* Paket aktif */}
      {loading ? (
        <LoadingSpinner text="Memuat paket..." />
      ) : active.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-10 text-center text-gray-400 text-sm">
          Belum ada paket aktif. Pelanggan tanpa paket dihitung satuan.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-cream-200 shadow-soft divide-y divide-cream-100 overflow-hidden">
          {active.map(p => {
            const pct = Math.min(100, Math.round((p.used / p.quota) * 100));
            const full = p.used >= p.quota;
            return (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-matcha-800 truncate">
                      {p.owner?.label || '—'}
                      <span className="font-medium text-gray-400"> · {p.name} · periode {p.period_no}{p.price > 0 ? ` · ${money(p.price, 'CNY')}` : ''}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${full ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-matcha-600'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">
                        {Math.min(p.used, p.quota)}/{p.quota}
                      </span>
                      {p.overflow > 0 && (
                        <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          +{p.overflow} kelebihan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => renew(p)} disabled={busy === p.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-matcha-800 hover:bg-matcha-700 text-white disabled:opacity-50">
                      ↻ Perpanjang
                    </button>
                    <button onClick={() => close(p)} disabled={busy === p.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Riwayat periode yang sudah ditutup */}
      {closed.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowHistory(v => !v)} className="text-xs font-semibold text-gray-500 hover:text-matcha-700">
            {showHistory ? '▲' : '▼'} Riwayat periode ({closed.length})
          </button>
          {showHistory && (
            <div className="mt-2 bg-white rounded-2xl border border-cream-200 divide-y divide-cream-100 text-xs">
              {closed.map(p => (
                <div key={p.id} className="px-4 py-2 flex items-center gap-2 text-gray-500">
                  <span className="flex-1 truncate">
                    <strong className="text-gray-700">{p.owner?.label}</strong> · {p.name} · periode {p.period_no}
                  </span>
                  <span>{Math.min(p.used, p.quota)}/{p.quota}{p.overflow ? ` +${p.overflow}` : ''}</span>
                  <span className="text-gray-400">ditutup {formatDate(p.closed_at, false)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
