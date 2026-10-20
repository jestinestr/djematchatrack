import { useEffect, useState } from 'react';
import { TncBody } from '../components/InfoTnc';
import { TNC_DEFAULT } from '../utils/tnc';

// Penyunting syarat & ketentuan yang dibaca pelanggan.
//
// Disimpan sebagai teks biasa di setelan, jadi bisa diubah kapan saja tanpa
// menyentuh kode. Pratinjaunya persis seperti yang dilihat pelanggan.
export default function AdminTnc() {
  const [teks, setTeks]   = useState('');
  const [awal, setAwal]   = useState('');
  const [ready, setReady] = useState(true);
  const [simpan, setSimpan] = useState(false);
  const [sukses, setSukses] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setTeks(d.tnc_text || '');
      setAwal(d.tnc_text || '');
      setReady(d._ready !== false);
    }).catch(() => {});
  }, []);

  async function simpanTeks() {
    setSimpan(true);
    const res = await fetch('/api/settings/tnc_text', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: teks }),
    });
    setSimpan(false);
    if (!res.ok) { setReady(false); return; }
    setAwal(teks);
    setSukses(true);
    setTimeout(() => setSukses(false), 2000);
  }

  const berubah = teks !== awal;
  const dipakai = teks.trim() || TNC_DEFAULT;

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">ℹ️</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Info &amp; Ketentuan</h1>
          <p className="text-sm text-gray-500">
            Dibaca pelanggan lewat menu Info di panelnya
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Penyunting */}
        <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-bold text-gray-600 flex-1">Teks ketentuan</p>
            {teks.trim() !== TNC_DEFAULT && (
              <button onClick={() => setTeks(TNC_DEFAULT)}
                className="text-[11px] text-matcha-700 font-semibold hover:underline">
                pakai draf bawaan
              </button>
            )}
          </div>

          <textarea
            rows={22} value={teks}
            onChange={e => setTeks(e.target.value)}
            placeholder="Kosongkan untuk memakai draf bawaan"
            className="w-full border border-cream-300 rounded-xl px-3 py-2 text-xs leading-relaxed font-mono"
          />

          <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
            Tulis <code>## Judul</code> untuk judul bagian, <code>- </code> di awal baris untuk
            butir, dan <code>**tebal**</code> untuk huruf tebal.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button onClick={simpanTeks} disabled={simpan || !berubah}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              {simpan ? 'Menyimpan…' : 'Simpan'}
            </button>
            {berubah && <span className="text-[11px] text-amber-700">ada perubahan belum disimpan</span>}
            {sukses && <span className="text-xs text-green-600 font-semibold">✓ Tersimpan</span>}
          </div>

          {!ready && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
              Setelan belum bisa disimpan — jalankan dulu
              <code className="mx-1">supabase/migrations/016_auto_acc_and_fix_request.sql</code>
              di Supabase.
            </p>
          )}
        </div>

        {/* Pratinjau seperti yang dilihat pelanggan */}
        <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-4">
          <p className="text-xs font-bold text-gray-600 mb-3">
            Yang dilihat pelanggan
            {!teks.trim() && <span className="font-normal text-gray-400"> (draf bawaan)</span>}
          </p>
          <TncBody teks={dipakai} />
        </div>
      </div>
    </div>
  );
}
