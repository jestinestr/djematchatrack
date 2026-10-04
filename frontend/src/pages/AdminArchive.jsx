import { useEffect, useState } from 'react';
import AddParcelModal from '../components/AddParcelModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { money, rupiah, baseFee, sumParcels, formatMulti } from '../utils/format';

const formatDate = str => (str
  ? new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  : '-');

/* ── Detail Drawer ──────────────────────────────────────── */
function BatchDetailDrawer({ batch, type, title, subtitle, onClose, onParcelEdited, onParcelDeleted }) {
  const [editingParcel, setEditingParcel] = useState(null);
  const parcels = batch.parcels || [];
  const totals = sumParcels(parcels, type);
  const totalFines = totals.fine;
  const hasFee = totals.IDR > 0 || totals.CNY > 0;

  async function handleDelete(parcelId) {
    if (!window.confirm('Hapus resi ini?')) return;
    const endpoint = type === 'HC' ? 'hc' : 'wh';
    const res = await fetch(`/api/parcels/${endpoint}/${parcelId}`, { method: 'DELETE' });
    if (res.ok) onParcelDeleted(parcelId);
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />

      {/* Drawer panel */}
      <div
        className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">{type === 'HC' ? '✈️' : '🏭'}</span>
            <div>
              <h2 className="font-bold text-matcha-800 text-base">{title}</h2>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">×</button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-5 py-2.5 bg-white border-b border-cream-200 text-xs text-gray-500 flex-shrink-0">
          <span>📦 {parcels.length} resi</span>
          {totalFines > 0 && <span className="text-red-500">⚠️ Denda {rupiah(totalFines)}</span>}
          {hasFee && <span className="text-amber-600">💰 {formatMulti(totals)}</span>}
        </div>

        {/* Parcel list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {parcels.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">Tidak ada resi</p>
            </div>
          ) : (
            parcels.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-cream-50 transition-colors">
                {/* Photos */}
                <div className="flex gap-1 flex-shrink-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="arrival" title="Foto Arrival" className="w-11 h-11 object-cover rounded-lg border border-gray-100" />
                  ) : (
                    <div className="w-11 h-11 bg-cream-100 rounded-lg flex items-center justify-center text-gray-300 text-lg border border-gray-100">📦</div>
                  )}
                  {p.co_photo_url && (
                    <div className="relative">
                      <img src={p.co_photo_url} alt="CO" title="Foto CO" className="w-11 h-11 object-cover rounded-lg border border-amber-200" />
                      <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[9px] font-bold px-1 rounded-full leading-4">CO</span>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{p.recipient_name}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{p.tracking_number}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs bg-matcha-50 text-matcha-700 px-1.5 py-0.5 rounded-full border border-matcha-100">
                      {p.type === 'paperbased' ? '📄 Paperbased' : '📦 Barang'}
                    </span>
                    {type === 'HC' && p.estimated_weight_grams > 0 && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{p.estimated_weight_grams}g</span>
                    )}
                    {type === 'HC' && p.estimated_quantity > 1 && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">{p.estimated_quantity} pcs</span>
                    )}
                    {baseFee(p, type) > 0 && (
                      <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">{money(baseFee(p, type), p.currency)}</span>
                    )}
                    {p.additional_fee > 0 && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">➕ {money(p.additional_fee, p.currency)}</span>
                    )}
                    {p.fine_amount > 0 && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">⚠️ Denda {rupiah(p.fine_amount)}</span>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditingParcel(p)} className="text-gray-300 hover:text-matcha-600 transition-colors p-1.5 rounded-lg hover:bg-matcha-50" title="Edit">✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Hapus">🗑</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit modal rendered outside drawer */}
      {editingParcel && (
        <AddParcelModal
          type={type}
          parcel={editingParcel}
          feePerGram={batch.fee_per_gram || 0}
          feeCurrency={batch.fee_currency || 'IDR'}
          fineAmount={Number(batch.fine_amount ?? 2000)}
          batchNumber={batch.batch_number}
          onClose={() => setEditingParcel(null)}
          onEdited={updated => { onParcelEdited(updated); setEditingParcel(null); }}
        />
      )}
    </div>
  );
}

/* ── Batch Row (table row) ──────────────────────────────── */
function BatchRow({ batch, type, icon, iconBg, title, subtitle, date, onClick }) {
  const parcels = batch.parcels || [];
  const totals = sumParcels(parcels, type);
  const totalFines = totals.fine;
  const hasFee = totals.IDR > 0 || totals.CNY > 0;

  return (
    <tr
      onClick={onClick}
      className="hover:bg-matcha-50 cursor-pointer transition-colors group"
    >
      {/* Icon + Batch name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 group-hover:text-matcha-700 transition-colors">
              {title}
            </p>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
        </div>
      </td>
      {/* Resi count */}
      <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
        {parcels.length} resi
      </td>
      {/* Fines / fees */}
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-col gap-0.5">
          {totalFines > 0 && <span className="text-xs text-red-500">⚠️ {rupiah(totalFines)}</span>}
          {hasFee && <span className="text-xs text-amber-600">💰 {formatMulti(totals)}</span>}
          {totalFines === 0 && !hasFee && <span className="text-xs text-gray-300">—</span>}
        </div>
      </td>
      {/* Date */}
      <td className="px-4 py-3 text-xs text-gray-400 hidden sm:table-cell whitespace-nowrap">
        {formatDate(date)}
      </td>
      {/* Chevron */}
      <td className="px-4 py-3 text-gray-300 group-hover:text-matcha-500 transition-colors text-right">
        ›
      </td>
    </tr>
  );
}

/* ── Main Archive Page ──────────────────────────────────── */
export default function AdminArchive() {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [closedBoxes, setClosedBoxes] = useState([]);
  const [billings, setBillings] = useState([]);
  const [selected, setSelected] = useState(null); // { batch, type, title, subtitle }

  // Arsip = box yang sudah ditutup, beserta status penagihannya.
  useEffect(() => {
    Promise.all([
      fetch('/api/parcels/wh/boxes').then(r => r.json()),
      fetch('/api/billings?status=all').then(r => r.json()).catch(() => ({ billings: [] })),
    ]).then(([boxData, billData]) => {
      setClosedBoxes((boxData.boxes || []).filter(b => b.status !== 'open'));
      setBillings(billData.billings || []);
      setLoading(false);
    });
  }, []);

  // Resi di box arsip masih bisa dibetulkan dari dalam laci
  function updateBox(boxId, ubah) {
    setClosedBoxes(prev => prev.map(b => (b.id === boxId ? { ...b, parcels: ubah(b.parcels || []) } : b)));
    setSelected(s => (s && s.batch.id === boxId
      ? { ...s, batch: { ...s.batch, parcels: ubah(s.batch.parcels || []) } }
      : s));
  }

  const handleParcelEdited = (type, boxId, updated) =>
    updateBox(boxId, list => list.map(p => (p.id === updated.id ? updated : p)));

  const handleParcelDeleted = (type, boxId, parcelId) =>
    updateBox(boxId, list => list.filter(p => p.id !== parcelId));

  // Penagihan terakhir tiap box, untuk menandai mana yang sudah lunas
  const billOf = boxId => billings
    .filter(b => b.scope === 'box' && String(b.ref_id) === String(boxId))
    .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))[0] || null;

  const rows = closedBoxes
    .map(b => {
      const bill = billOf(b.id);
      return {
        key: `BOX-${b.id}`,
        batch: b,
        type: 'WH',
        icon: '📦',
        iconBg: 'bg-matcha-100',
        title: `${b.owner?.label || 'Tanpa pemilik'} — ${b.name}`,
        subtitle: bill
          ? (bill.status === 'paid' ? '✓ Sudah lunas' : '🧾 Sudah ditagih, belum lunas')
          : 'Belum ditagih',
        bill,
        date: b.closed_at,
        sort: b.closed_at,
      };
    })
    .filter(r => filter === 'all'
      || (filter === 'paid' && r.bill?.status === 'paid')
      || (filter === 'unpaid' && r.bill?.status !== 'paid'))
    .sort((a, b) => new Date(b.sort || 0) - new Date(a.sort || 0));

  const totalArchived = closedBoxes.length;

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📁</span>
          <div>
            <h1 className="text-xl font-bold text-matcha-800">Arsip</h1>
            <p className="text-sm text-gray-500">{totalArchived} box ditutup</p>
          </div>
        </div>
        {/* Filter */}
        <div className="flex gap-1 bg-white border border-cream-200 rounded-xl p-1">
          {[['all', 'Semua'], ['unpaid', '🧾 Belum lunas'], ['paid', '✓ Lunas']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === val ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner text="Memuat arsip..." />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">🗄️</div>
          <p>Belum ada box yang diarsipkan</p>
          <p className="text-sm mt-1">Box yang sudah ditutup muncul di sini</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-2.5 border-b border-cream-100 bg-cream-50">
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_120px_110px_24px] gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>Box</span>
              <span className="hidden sm:block">Resi</span>
              <span className="hidden md:block">Denda / Fee</span>
              <span className="hidden sm:block">Tanggal Selesai</span>
              <span />
            </div>
          </div>

          {/* Rows */}
          <table className="w-full">
            <tbody>
              {rows.map(row => (
                <BatchRow
                  key={row.key}
                  batch={row.batch}
                  type={row.type}
                  icon={row.icon}
                  iconBg={row.iconBg}
                  title={row.title}
                  subtitle={row.subtitle}
                  date={row.date}
                  onClick={() => setSelected(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <BatchDetailDrawer
          batch={selected.batch}
          type={selected.type}
          title={selected.title}
          subtitle={`${selected.subtitle} · ${formatDate(selected.date)}`}
          onClose={() => setSelected(null)}
          onParcelEdited={updated => handleParcelEdited(selected.type, selected.batch.id, updated)}
          onParcelDeleted={parcelId => handleParcelDeleted(selected.type, selected.batch.id, parcelId)}
        />
      )}
    </div>
  );
}
