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

  function openModal(type) { setModal(type); setCode(''); setError(''); }
  function closeModal()     { setModal(null);  setCode(''); setError(''); }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, #2A4A40 0%, #3D6B5E 50%, #4D8578 100%)' }}>

      {/* Soft glow orbs for depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
             style={{ background: 'radial-gradient(circle, #7BB4A4, transparent)' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full opacity-15"
             style={{ background: 'radial-gradient(circle, #AACFC3, transparent)' }} />
      </div>

      {/* Brand */}
      <div className="relative text-center mb-10">
        <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-5 shadow-soft-lg border border-white/20 overflow-hidden">
          <img src="/ava.png" alt="Djematcha" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Djematcha</h1>
        <p className="text-matcha-200 mt-2 text-base font-medium opacity-80">Sistem Tracking Paket</p>
        <div className="mt-3 h-px w-12 bg-white/30 mx-auto rounded-full" />
      </div>

      {/* Panel buttons */}
      <div className="relative flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-sm">
        <button
          onClick={() => openModal('hc')}
          className="flex-1 group bg-white/90 backdrop-blur-sm hover:bg-white text-matcha-800 font-bold
                     py-6 px-5 rounded-3xl shadow-soft-lg transition-all duration-200
                     hover:scale-[1.03] hover:shadow-soft-lg border border-white/60"
        >
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">✈️</div>
          <div className="text-base">Hand Carry</div>
          <div className="text-xs text-matcha-500 font-normal mt-0.5">Paket Bawaan</div>
        </button>
        <button
          onClick={() => openModal('wh')}
          className="flex-1 group bg-white/90 backdrop-blur-sm hover:bg-white text-matcha-800 font-bold
                     py-6 px-5 rounded-3xl shadow-soft-lg transition-all duration-200
                     hover:scale-[1.03] hover:shadow-soft-lg border border-white/60"
        >
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">🏭</div>
          <div className="text-base">Warehouse</div>
          <div className="text-xs text-matcha-500 font-normal mt-0.5">Paket Gudang</div>
        </button>
      </div>

      <p className="relative mt-10 text-matcha-300 text-xs opacity-70">
        Admin?{' '}
        <a href="/admin" className="text-white/80 underline underline-offset-2 hover:text-white transition-colors">
          Masuk sini
        </a>
      </p>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="bg-white rounded-3xl shadow-soft-lg p-7 w-full max-w-sm border border-cream-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-matcha-50 flex items-center justify-center mx-auto mb-3 text-3xl border border-matcha-100">
                {modal === 'hc' ? '✈️' : '🏭'}
              </div>
              <h2 className="text-xl font-bold text-matcha-800">
                {modal === 'hc' ? 'Hand Carry' : 'Warehouse'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Masukkan kode akses</p>
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
                <p className="text-rose-500 text-sm text-center mb-3 bg-rose-50 py-2 px-3 rounded-xl border border-rose-100">
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
