import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function AdminCodes() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ code: '', label: '' });
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
      setForm({ code: '', label: '' });
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
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="bg-matcha-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <h1 className="font-bold text-lg leading-tight">Kelola Kode Akses</h1>
              <p className="text-matcha-200 text-xs">Atur kode untuk pengguna</p>
            </div>
          </div>
          <Link to="/admin/dashboard" className="text-sm text-matcha-200 hover:text-white underline underline-offset-2">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Add form */}
        <div className="card mb-6">
          <h2 className="font-bold text-matcha-800 mb-4">Tambah Kode Baru</h2>
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
            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Menyimpan...' : '+ Tambah Kode'}
            </button>
          </form>
        </div>

        {/* Codes list */}
        <div className="card">
          <h2 className="font-bold text-matcha-800 mb-4">Daftar Kode ({codes.length})</h2>
          {loading ? (
            <p className="text-center text-gray-400 py-6">Memuat...</p>
          ) : codes.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Belum ada kode akses</p>
          ) : (
            <div className="space-y-2">
              {codes.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-cream-50 rounded-xl p-3 border border-cream-200">
                  <div>
                    <p className="font-semibold text-matcha-800 text-sm">{c.label}</p>
                    <p className="text-xs font-mono text-gray-500 mt-0.5 tracking-wide">{c.code}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors text-lg leading-none"
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
    </div>
  );
}
