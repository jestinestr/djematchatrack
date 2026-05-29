import { useEffect, useState } from 'react';

export default function AdminCodes() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ code: '', label: '', access_hc: true, access_wh: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (!window.confirm('Hapus kode akses ini?')) return;
    await fetch(`/api/codes/${id}`, { method: 'DELETE' });
    setCodes(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🔑</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Kode Akses</h1>
          <p className="text-sm text-gray-500">Kelola akses masuk untuk pengguna</p>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-cream-200 p-5 mb-5 shadow-sm">
        <h2 className="font-semibold text-matcha-800 mb-4 text-sm uppercase tracking-wide">Tambah Kode Baru</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
              <input
                className="input-field"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Kode Toko A"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kode Akses <span className="text-red-500">*</span></label>
              <input
                className="input-field font-mono"
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="kode123"
                required
              />
            </div>
          </div>
          {/* Access checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Akses Panel</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.access_hc ? 'border-matcha-400 bg-matcha-50' : 'border-gray-200 bg-gray-50'}`}>
                <input type="checkbox" checked={form.access_hc} onChange={e => setForm(f => ({ ...f, access_hc: e.target.checked }))} className="w-4 h-4 accent-matcha-700" />
                <span className="text-sm font-medium text-gray-700">✈️ Hand Carry</span>
              </label>
              <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.access_wh ? 'border-matcha-400 bg-matcha-50' : 'border-gray-200 bg-gray-50'}`}>
                <input type="checkbox" checked={form.access_wh} onChange={e => setForm(f => ({ ...f, access_wh: e.target.checked }))} className="w-4 h-4 accent-matcha-700" />
                <span className="text-sm font-medium text-gray-700">🏭 Warehouse</span>
              </label>
            </div>
            {!form.access_hc && !form.access_wh && (
              <p className="text-amber-600 text-xs mt-1.5">⚠️ Pilih minimal satu akses</p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={saving || (!form.access_hc && !form.access_wh)} className="btn-primary w-full">
            {saving ? 'Menyimpan...' : '+ Tambah Kode'}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-cream-100">
          <h2 className="font-semibold text-matcha-800 text-sm uppercase tracking-wide">
            Daftar Kode <span className="text-gray-400 font-normal normal-case">({codes.length})</span>
          </h2>
        </div>
        {loading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Memuat...</p>
        ) : codes.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">Belum ada kode akses</p>
        ) : (
          <div className="divide-y divide-cream-100">
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-cream-50 transition-colors">
                <div>
                  <p className="font-semibold text-matcha-800 text-sm">{c.label}</p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5 tracking-wider">{c.code}</p>
                  <div className="flex gap-1 mt-1.5">
                    {(c.access_hc ?? true) && (
                      <span className="text-xs bg-matcha-50 text-matcha-700 border border-matcha-200 px-1.5 py-0.5 rounded-full">✈️ HC</span>
                    )}
                    {(c.access_wh ?? true) && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">🏭 WH</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 text-lg leading-none"
                  title="Hapus"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
