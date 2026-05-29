import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // 'hc' | 'wh' | null
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Kode tidak valid'); return; }

      // Cek permission berdasarkan panel yang dipilih
      if (modal === 'hc' && !data.access_hc) {
        setError('Kode ini tidak memiliki akses ke Hand Carry');
        return;
      }
      if (modal === 'wh' && !data.access_wh) {
        setError('Kode ini tidak memiliki akses ke Warehouse');
        return;
      }
      navigate(modal === 'hc' ? '/hc' : '/wh');
    } catch {
      setError('Koneksi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  function openModal(type) {
    setModal(type);
    setCode('');
    setError('');
  }

  function closeModal() {
    setModal(null);
    setCode('');
    setError('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-matcha-800 via-matcha-700 to-matcha-600 flex flex-col items-center justify-center p-6">
      {/* Brand */}
      <div className="text-center mb-12">
        <div className="text-7xl mb-4">🍵</div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Djematcha</h1>
        <p className="text-matcha-200 mt-2 text-lg font-medium">Sistem Tracking Paket</p>
        <div className="mt-3 h-0.5 w-16 bg-cream-200 mx-auto rounded-full opacity-60" />
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <button
          onClick={() => openModal('hc')}
          className="flex-1 bg-white hover:bg-cream-100 text-matcha-800 font-bold py-5 px-6 rounded-2xl shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
        >
          <div className="text-3xl mb-2">✈️</div>
          <div className="text-lg">Hand Carry</div>
          <div className="text-xs text-matcha-500 font-normal mt-0.5">Paket Bawaan</div>
        </button>
        <button
          onClick={() => openModal('wh')}
          className="flex-1 bg-white hover:bg-cream-100 text-matcha-800 font-bold py-5 px-6 rounded-2xl shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
        >
          <div className="text-3xl mb-2">🏭</div>
          <div className="text-lg">Warehouse</div>
          <div className="text-xs text-matcha-500 font-normal mt-0.5">Paket Gudang</div>
        </button>
      </div>

      <p className="mt-10 text-matcha-300 text-xs">
        Admin?{' '}
        <a href="/admin" className="text-cream-200 underline underline-offset-2 hover:text-white">
          Masuk sini
        </a>
      </p>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">{modal === 'hc' ? '✈️' : '🏭'}</div>
              <h2 className="text-xl font-bold text-matcha-800">
                {modal === 'hc' ? 'Hand Carry' : 'Warehouse'}
              </h2>
              <p className="text-gray-500 text-sm mt-1">Masukkan kode akses untuk melihat paket</p>
            </div>

            <form onSubmit={handleVerify}>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Kode akses..."
                className="input-field text-center text-lg tracking-widest mb-3"
                autoFocus
                required
              />
              {error && (
                <p className="text-red-600 text-sm text-center mb-3 bg-red-50 py-2 px-3 rounded-lg">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading ? 'Memeriksa...' : 'Masuk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
