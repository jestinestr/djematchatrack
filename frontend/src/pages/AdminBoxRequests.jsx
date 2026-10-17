import { useCallback, useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { money, formatDate } from '../utils/format';

// Permintaan tutup box dari pelanggan — admin tinggal menyetujui.
//
// Menyetujui berarti boxnya ditutup dan resi yang dipilih ikut terarsip;
// resi lain di box itu dipindahkan dulu ke box berikutnya supaya tidak
// ikut terkirim.
const TABS = [
  { key: 'pending',  label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
];

export default function AdminBoxRequests() {
  const [tab, setTab]         = useState('pending');
  const [list, setList]       = useState([]);
  const [ready, setReady]     = useState(true);
  const [loading, setLoading] = useState(true);
  const [sibuk, setSibuk]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch(`/api/box-requests?status=${tab}`).then(r => r.json());
      setList(d.requests || []);
      setReady(d.ready !== false);
    } catch {
      setList([]);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function putuskan(id, aksi) {
    const catatan = aksi === 'reject'
      ? window.prompt('Alasan ditolak (dibaca pelanggan di catatan admin):') ?? null
      : null;
    if (aksi === 'reject' && catatan === null) return;

    setSibuk(id);
    const res = await fetch(`/api/box-requests/${id}/${aksi}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_note: catatan }),
    });
    const data = await res.json();
    setSibuk(null);

    if (!res.ok) { alert(data.error || 'Gagal memproses permintaan'); return; }
    if (aksi === 'approve') {
      alert(`Box ditutup${data.moved ? ` · ${data.moved} resi yang tidak ikut dipindah ke box berikutnya` : ''}`);
    }
    load();
  }

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📮</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Req Close Box</h1>
          <p className="text-sm text-gray-500">
            Pelanggan memilih resinya sendiri, kamu tinggal menyetujui
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-cream-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
              tab === t.key
                ? 'border-matcha-700 text-matcha-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {!ready && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
          Fitur ini belum aktif — jalankan dulu
          <code className="mx-1">supabase/migrations/020_box_close_requests.sql</code>
          di Supabase.
        </p>
      )}

      {loading ? (
        <LoadingSpinner text="Memuat permintaan..." />
      ) : !list.length ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-10 text-center text-gray-400 text-sm">
          {tab === 'pending' ? 'Tidak ada permintaan yang menunggu' : 'Belum ada'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(r => (
            <Kartu key={r.id} r={r} sibuk={sibuk === r.id} onPutuskan={putuskan} />
          ))}
        </div>
      )}
    </div>
  );
}

function Kartu({ r, sibuk, onPutuskan }) {
  const tanpaFoto = (r.parcels || []).filter(p => !p.photo_url);
  const bisaSetuju = r.status === 'pending' && !tanpaFoto.length && (r.parcels || []).length > 0;

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
      <div className="px-4 py-3 bg-cream-50 border-b border-cream-200 flex items-center gap-2 flex-wrap">
        <span className="font-bold text-matcha-800 text-sm">{r.owner?.label || '—'}</span>
        {r.box && (
          <span className="text-[11px] bg-white border border-cream-300 text-gray-500 px-2 py-0.5 rounded-full">
            {r.box.name}
          </span>
        )}
        <span className="text-[11px] text-gray-400">{r.parcel_count} resi</span>
        <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${
          r.status === 'pending'  ? 'bg-amber-100 text-amber-700'
          : r.status === 'approved' ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {r.status === 'pending' ? '⏳ Menunggu' : r.status === 'approved' ? '✓ Disetujui' : '✕ Ditolak'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Alamat & pilihan pengiriman */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Alamat</p>
            <p className="text-sm text-gray-700 leading-snug mt-0.5 whitespace-pre-line">{r.address}</p>
            <p className="text-xs text-gray-500 mt-1">
              {r.recipient_name || r.owner?.label}
              {r.phone ? ` · ${r.phone}` : ''}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Ekspedisi:</span>{' '}
              {r.courier === 'sf' ? 'SF' : 'General'}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Cairan/baterai/mahal:</span>{' '}
              {r.sf_ok
                ? <span className="text-green-700">boleh dialihkan ke SF</span>
                : <span className="text-amber-700">tanyakan dulu ke pelanggan</span>}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-semibold">Asuransi:</span>{' '}
              {r.insurance
                ? <span className="text-green-700">perlu · {money(r.insurance_cny, 'CNY')}</span>
                : 'tidak perlu'}
            </p>
            <p className="text-[11px] text-gray-400">Diajukan {formatDate(r.created_at, false)}</p>
          </div>
        </div>

        {/* Resi yang diminta */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Resi yang ikut
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(r.parcels || []).map(p => (
              <span key={p.id}
                className={`text-[11px] font-mono px-2 py-1 rounded-lg border ${
                  p.photo_url
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                {p.photo_url ? '📷' : '✕'} {p.tracking_number}
              </span>
            ))}
          </div>
          {tanpaFoto.length > 0 && (
            <p className="text-[11px] text-red-600 mt-1.5">
              {tanpaFoto.length} resi belum ada foto arrival — upload dulu sebelum box ditutup.
            </p>
          )}
        </div>

        {r.note && (
          <p className="text-xs text-gray-600 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2">
            <span className="font-semibold">Catatan pelanggan:</span> {r.note}
          </p>
        )}
        {r.admin_note && (
          <p className="text-xs text-gray-600 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2">
            <span className="font-semibold">Catatanmu:</span> {r.admin_note}
          </p>
        )}

        {r.status === 'pending' && (
          <div className="flex gap-2 pt-1">
            <button onClick={() => onPutuskan(r.id, 'approve')} disabled={sibuk || !bisaSetuju}
              className="btn-primary text-sm px-4 py-2 flex-1 disabled:opacity-50"
              title={bisaSetuju ? 'Tutup box dan setujui' : 'Masih ada resi tanpa foto arrival'}>
              {sibuk ? 'Memproses…' : '✓ Setujui & tutup box'}
            </button>
            <button onClick={() => onPutuskan(r.id, 'reject')} disabled={sibuk}
              className="btn-secondary text-sm px-4 py-2 disabled:opacity-50">
              Tolak
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
