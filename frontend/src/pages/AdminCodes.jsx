import { useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const PANELS = [
  { key: 'access_hc', icon: '✈️', title: 'Hand Carry', sub: 'Paket Bawaan' },
  { key: 'access_wh', icon: '🏭', title: 'Warehouse', sub: 'Paket Gudang' },
];

export default function AdminCodes() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ code: '', label: '', access_hc: true, access_wh: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    fetch('/api/codes').then(r => r.json()).then(data => { setCodes(data); setLoading(false); });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setCodes(prev => [data, ...prev]);
      setForm({ code: '', label: '', access_hc: true, access_wh: true });
    } catch {
      setError('Koneksi gagal');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus kode akses ini? Resi yang sudah ada tetap tersimpan, tapi pemiliknya jadi kosong.')) return;
    await fetch(`/api/codes/${id}`, { method: 'DELETE' });
    setCodes(prev => prev.filter(c => c.id !== id));
  }

  function copyCode(code, id) {
    navigator.clipboard?.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(c => (c === id ? null : c)), 1500);
  }

  const noAccess = !form.access_hc && !form.access_wh;

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-matcha-500 to-matcha-700 flex items-center justify-center text-2xl shadow-soft-lg shrink-0">
          🔑
        </div>
        <div>
          <h1 className="text-xl font-bold text-matcha-800 leading-tight">Kode Akses</h1>
          <p className="text-sm text-gray-500">Kelola akses masuk untuk pelanggan</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-3xl border border-cream-200 p-6 mb-6 shadow-soft-lg">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-6 h-6 rounded-lg bg-matcha-50 text-matcha-700 flex items-center justify-center text-sm">＋</span>
          <h2 className="font-bold text-matcha-800 text-sm">Tambah Kode Baru</h2>
        </div>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Nama Pelanggan <span className="text-berry-400">*</span>
              </label>
              <input
                className="input-field"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="cth: Alin"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Kode Akses <span className="text-berry-400">*</span>
              </label>
              <input
                className="input-field font-mono"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="cth: alin123"
                required
              />
            </div>
          </div>

          {/* Access toggles */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Akses Panel</label>
            <div className="grid grid-cols-2 gap-3">
              {PANELS.map(({ key, icon, title, sub }) => (
                <label
                  key={key}
                  className={`relative flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    form[key] ? 'border-matcha-400 bg-matcha-50 shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    className="peer sr-only"
                  />
                  <span className="text-xl">{icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-gray-700 leading-tight">{title}</span>
                    <span className="block text-xs text-gray-400">{sub}</span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-white text-xs transition-all ${
                      form[key] ? 'bg-matcha-600 border-matcha-600' : 'border-gray-300'
                    }`}
                  >
                    {form[key] && '✓'}
                  </span>
                </label>
              ))}
            </div>
            {noAccess && <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">⚠️ Pilih minimal satu akses</p>}
          </div>

          {error && (
            <p className="text-berry-600 text-sm bg-berry-50 border border-berry-100 px-3.5 py-2.5 rounded-xl flex items-center gap-2">
              <span>⚠️</span> {error}
            </p>
          )}
          <button type="submit" disabled={saving || noAccess} className="btn-primary w-full">
            {saving ? 'Menyimpan...' : '+ Tambah Kode'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="font-bold text-matcha-800 text-sm">Daftar Kode</h2>
        <span className="text-xs font-semibold text-matcha-600 bg-matcha-50 border border-matcha-100 px-2.5 py-1 rounded-full">
          {codes.length} kode
        </span>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-cream-200 shadow-soft-lg">
          <LoadingSpinner text="Memuat..." className="py-8" />
        </div>
      ) : codes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-cream-200 shadow-soft-lg text-center py-14 px-6">
          <div className="text-4xl mb-3 opacity-40">🔑</div>
          <p className="text-gray-500 text-sm font-medium">Belum ada kode akses</p>
          <p className="text-gray-400 text-xs mt-1">Tambah kode pertama lewat form di atas</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {codes.map(c => (
            <CodeRow
              key={c.id}
              code={c}
              copied={copied === c.id}
              onCopy={() => copyCode(c.code, c.id)}
              onDelete={() => handleDelete(c.id)}
              onSaved={updated => setCodes(prev => prev.map(x => (x.id === updated.id ? updated : x)))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Satu baris kode akses, bisa diedit di tempat ────────── */
function CodeRow({ code: c, copied, onCopy, onDelete, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startEdit() {
    setForm({
      label: c.label,
      code: c.code,
      access_hc: c.access_hc ?? true,
      access_wh: c.access_wh ?? true,
    });
    setError('');
    setEditing(true);
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/codes/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal menyimpan'); return; }
      onSaved(data);
      setEditing(false);
    } catch {
      setError('Koneksi gagal');
    } finally {
      setSaving(false);
    }
  }

  // ── Mode edit ───────────────────────────────────────────
  if (editing) {
    const noAccess = !form.access_hc && !form.access_wh;
    return (
      <div className="bg-white rounded-2xl border-2 border-matcha-300 px-4 py-4 shadow-soft-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Nama Pelanggan</label>
            <input className="input-field" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Kode Akses</label>
            <input className="input-field font-mono" value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Akses Panel</label>
          <div className="grid grid-cols-2 gap-3">
            {PANELS.map(({ key, icon, title }) => (
              <label key={key}
                className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                  form[key] ? 'border-matcha-400 bg-matcha-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}>
                <input type="checkbox" checked={form[key]} className="sr-only"
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                <span className="text-lg">{icon}</span>
                <span className="flex-1 text-sm font-semibold text-gray-700">{title}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-white text-xs transition-all ${
                  form[key] ? 'bg-matcha-600 border-matcha-600' : 'border-gray-300'
                }`}>
                  {form[key] && '✓'}
                </span>
              </label>
            ))}
          </div>
          {noAccess && <p className="text-amber-600 text-xs mt-2">⚠️ Minimal satu akses harus aktif</p>}
        </div>

        <p className="text-[11px] text-gray-500 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 leading-relaxed">
          Mematikan akses hanya menutup panelnya untuk pelanggan ini. Resi miliknya yang sudah ada
          di batch aktif maupun batch lama <strong>tidak terhapus</strong> — tetap tersimpan sebagai
          rekam jejak dan masih ikut terhitung di invoice.
        </p>

        {error && (
          <p className="text-berry-600 text-sm bg-berry-50 border border-berry-100 px-3 py-2 rounded-xl">⚠️ {error}</p>
        )}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || noAccess} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Menyimpan...' : '💾 Simpan Perubahan'}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary px-4">Batal</button>
        </div>
      </div>
    );
  }

  // ── Mode tampil ─────────────────────────────────────────
  return (
    <div className="group flex items-center gap-3.5 bg-white rounded-2xl border border-cream-200 px-4 py-3.5 shadow-sm hover:shadow-soft-lg hover:border-matcha-200 transition-all">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-matcha-400 to-matcha-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
        {(c.label?.trim()?.[0] || '?').toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-matcha-800 text-sm truncate">{c.label}</p>
        <button
          onClick={onCopy}
          className="group/code inline-flex items-center gap-1.5 mt-1 text-xs font-mono text-gray-500 bg-gray-50 hover:bg-matcha-50 hover:text-matcha-700 border border-gray-100 px-2 py-0.5 rounded-lg transition-colors"
          title="Klik untuk salin"
        >
          <span className="tracking-wider">{c.code}</span>
          <span className="opacity-50 group-hover/code:opacity-100">{copied ? '✓' : '⧉'}</span>
        </button>
        <div className="flex gap-1.5 mt-1.5">
          {(c.access_hc ?? true) ? (
            <span className="text-[11px] font-medium bg-matcha-50 text-matcha-700 border border-matcha-200 px-2 py-0.5 rounded-full">✈️ HC</span>
          ) : (
            <span className="text-[11px] font-medium bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">✈️ HC nonaktif</span>
          )}
          {(c.access_wh ?? true) ? (
            <span className="text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">🏭 WH</span>
          ) : (
            <span className="text-[11px] font-medium bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">🏭 WH nonaktif</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={startEdit}
          className="text-gray-400 hover:text-matcha-700 hover:bg-matcha-50 transition-colors p-2 rounded-xl"
          title="Edit nama, kode, dan hak akses"
        >
          ✏️
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-berry-500 hover:bg-berry-50 transition-colors p-2 rounded-xl text-lg leading-none"
          title="Hapus kode akses"
        >
          🗑
        </button>
      </div>
    </div>
  );
}
