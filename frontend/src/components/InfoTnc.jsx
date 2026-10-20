import { useEffect, useState } from 'react';
import { TNC_DEFAULT, parseTnc, potongTebal } from '../utils/tnc';

// Halaman info untuk pelanggan: syarat & ketentuan warehouse.
//
// Isinya diambil dari setelan yang ditulis admin; kalau admin belum pernah
// menyimpannya, yang tampil teks bawaan — jadi pelanggan tidak pernah
// melihat halaman kosong.
export default function InfoTnc({ onClose }) {
  const [teks, setTeks] = useState(TNC_DEFAULT);

  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.tnc_text?.trim()) setTeks(d.tnc_text); })
      .catch(() => {});
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-matcha-800">ℹ️ Info &amp; Ketentuan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Syarat &amp; ketentuan jastip warehouse</p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
            ×
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <TncBody teks={teks} />
          <p className="text-[11px] text-gray-400 mt-5 text-center leading-snug">
            Dengan menitipkan barang ke warehouse, kamu dianggap sudah membaca
            dan menyetujui ketentuan di atas 🤍
          </p>
        </div>
      </div>
    </div>
  );
}

// Tampilan teksnya — dipakai juga untuk pratinjau di panel admin
export function TncBody({ teks }) {
  const blok = parseTnc(teks);
  if (!blok.length) {
    return <p className="text-sm text-gray-400">Belum ada ketentuan yang ditulis.</p>;
  }

  return (
    <div className="space-y-1">
      {blok.map((b, i) =>
        b.jenis === 'judul' ? (
          <h3 key={i} className="text-sm font-bold text-matcha-800 pt-3 first:pt-0">
            {b.isi}
          </h3>
        ) : b.jenis === 'butir' ? (
          <div key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
            <span className="text-matcha-400 flex-shrink-0">•</span>
            <p className="min-w-0"><Baris isi={b.isi} /></p>
          </div>
        ) : (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            <Baris isi={b.isi} />
          </p>
        )
      )}
    </div>
  );
}

function Baris({ isi }) {
  return potongTebal(isi).map((bagian, i) =>
    bagian.tebal
      ? <b key={i} className="text-gray-900">{bagian.isi}</b>
      : <span key={i}>{bagian.isi}</span>
  );
}
