import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      sessionStorage.setItem('admin_token', data.token);
      navigate('/admin/dashboard');
    } catch {
      setError('Koneksi gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #2A4A40 0%, #3D6B5E 50%, #4D8578 100%)' }}>
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-soft-lg p-8 w-full max-w-sm border border-white/60">
        <div className="text-center mb-7">
          <div className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 shadow-soft border border-white/40">
            <img src="/ava.png" alt="Djematcha" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-matcha-800">Admin Djematcha</h1>
          <p className="text-gray-400 text-sm mt-1">Masuk ke panel admin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="input-field"
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg text-center">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center mt-5">
          <a href="/" className="text-matcha-600 text-sm hover:underline">← Kembali ke beranda</a>
        </p>
      </div>
    </div>
  );
}
