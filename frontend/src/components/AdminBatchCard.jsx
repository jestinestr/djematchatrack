import { useMemo, useState } from 'react';
import AddParcelModal from './AddParcelModal';
import ParcelDetailModal from './ParcelDetailModal';
import LabelPrintModal from './LabelPrintModal';
import Pager, { usePaged } from './Pager';
import { money, rupiah, baseFee, formatWeight, sumParcels, formatMulti } from '../utils/format';

export default function AdminBatchCard({
  batch,
  type,
  onComplete,
  onParcelAdded,
  onParcelDeleted,
  onParcelEdited,
  readOnly = false,
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingParcel, setEditingParcel] = useState(null);
  const [detailParcel, setDetailParcel] = useState(null);
  const [showParcels, setShowParcels] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [openOwner, setOpenOwner] = useState(null);
  const [labelMode, setLabelMode] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [showLabels, setShowLabels] = useState(false);
  const [isPrivate, setIsPrivate] = useState(!!batch.is_private);
  const [savingPrivate, setSavingPrivate] = useState(false);

  const parcels = batch.parcels || [];
  const feePerGram = batch.fee_per_gram || 0;
  const feeCurrency = batch.fee_currency || 'IDR';
  const isActive = batch.status === 'active';

  const totals = useMemo(() => sumParcels(parcels, type), [parcels, type]);
  const paged = usePaged(parcels, 10);

  // Kelompokkan resi per pemilik
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of parcels) {
      const key = p.owner ? String(p.owner.id) : '__none__';
      if (!map.has(key)) map.set(key, { key, owner: p.owner || null, parcels: [] });
      map.get(key).parcels.push(p);
    }
    return [...map.values()]
      .map(g => ({ ...g, totals: sumParcels(g.parcels, type) }))
      .sort((a, b) => {
        if (!a.owner) return 1;
        if (!b.owner) return -1;
        return a.owner.label.localeCompare(b.owner.label, 'id');
      });
  }, [parcels, type]);

  async function handleComplete() {
    if (!window.confirm(`Selesaikan Batch #${batch.batch_number}? Batch baru akan otomatis dibuat.`)) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/batches/${batch.id}/complete`, { method: 'POST' });
      if (res.ok) onComplete?.();
    } finally {
      setCompleting(false);
    }
  }

  async function togglePrivate() {
    const next = !isPrivate;
    setSavingPrivate(true);
    try {
      const res = await fetch(`/api/batches/${batch.id}/private`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_private: next }),
      });
      if (res.ok) setIsPrivate(next);
    } finally {
      setSavingPrivate(false);
    }
  }

  async function handleDelete(parcelId) {
    if (!window.confirm('Hapus resi ini?')) return;
    const endpoint = type === 'HC' ? 'hc' : 'wh';
    const res = await fetch(`/api/parcels/${endpoint}/${parcelId}`, { method: 'DELETE' });
    if (res.ok) onParcelDeleted?.(batch.id, parcelId);
  }

  const parcelRow = p => (
    <ParcelRow
      key={p.id}
      parcel={p}
      type={type}
      readOnly={readOnly}
      showOwner={!groupMode}
      selectable={labelMode}
      selected={picked.has(p.id)}
      onToggle={() => setPicked(prev => {
        const next = new Set(prev);
        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
        return next;
      })}
      onOpen={() => setDetailParcel(p)}
      onEdit={() => setEditingParcel(p)}
      onDelete={() => handleDelete(p.id)}
    />
  );

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden mb-4 ${isActive ? 'border-matcha-200' : 'border-gray-200 opacity-80'}`}>
        {/* Header batch */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 ${isActive ? 'bg-matcha-50 border-b border-matcha-100' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${isActive ? 'bg-matcha-800 text-white' : 'bg-gray-400 text-white'}`}>
              Batch #{batch.batch_number}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isActive ? '● Aktif' : '✓ Selesai'}
            </span>
            {!readOnly && (
              <button
                onClick={togglePrivate}
                disabled={savingPrivate}
                title="Saat private, pelanggan hanya melihat resi miliknya secara utuh"
                className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors disabled:opacity-50 ${
                  isPrivate
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                {isPrivate ? '🔒 Private' : '🌐 Publik'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isActive && !readOnly && (
              <>
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-xs bg-matcha-800 hover:bg-matcha-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Tambah
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {completing ? '...' : '✅ Selesai'}
                </button>
              </>
            )}
            {!readOnly && parcels.length > 0 && (
              <button
                onClick={() => { setLabelMode(v => !v); setPicked(new Set()); setShowParcels(true); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-2 transition-colors ${
                  labelMode
                    ? 'bg-matcha-800 text-white border-matcha-800'
                    : 'bg-white text-matcha-700 border-cream-300 hover:border-matcha-400'
                }`}
              >
                🏷 Label
              </button>
            )}
            <button
              onClick={() => setShowParcels(v => !v)}
              className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 px-2 py-1.5 rounded-lg transition-colors"
            >
              {showParcels ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Ringkasan batch */}
        <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 border-b border-gray-100 items-center">
          <span>📦 {parcels.length} resi</span>
          <span>👤 {groups.filter(g => g.owner).length} pelanggan</span>
          {totals.weight > 0 && <span className="text-blue-500">⚖️ {formatWeight(totals.weight)}</span>}
          {(totals.IDR > 0 || totals.CNY > 0) && (
            <span className="text-matcha-600 font-medium">💰 {formatMulti(totals)}</span>
          )}
          {totals.fine > 0 && <span className="text-red-500">⚠️ Denda {rupiah(totals.fine)}</span>}
          {!isActive && batch.completed_at && (
            <span className="text-gray-400 ml-auto">
              Selesai {new Date(batch.completed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Penjelasan mode private */}
        {isPrivate && (
          <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-100 text-xs text-amber-700">
            🔒 Pelanggan hanya melihat resi miliknya secara utuh. Resi pelanggan lain tampil
            sebagai 4 digit terakhir + nama, fotonya disembunyikan.
          </div>
        )}

        {/* Bar pilih label */}
        {labelMode && (
          <div className="px-4 py-2 border-b border-matcha-100 bg-matcha-50/70 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setPicked(picked.size === parcels.length ? new Set() : new Set(parcels.map(p => p.id)))}
              className="text-xs font-semibold text-matcha-700 hover:underline"
            >
              {picked.size === parcels.length ? 'Batal semua' : `Pilih semua (${parcels.length})`}
            </button>
            <span className="text-xs text-gray-500">{picked.size} dipilih</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowLabels(true)}
              disabled={!picked.size}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-matcha-800 text-white disabled:opacity-40 transition-colors"
            >
              🖨 Cetak Label ({picked.size})
            </button>
            <button
              onClick={() => { setLabelMode(false); setPicked(new Set()); }}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
            >
              Batal
            </button>
          </div>
        )}

        {/* Pilihan tampilan */}
        {showParcels && parcels.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex gap-1 bg-cream-50/60">
            {[[false, '📦 Per Resi'], [true, '👤 Per Orang']].map(([val, label]) => (
              <button
                key={label}
                onClick={() => { setGroupMode(val); setOpenOwner(null); }}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  groupMode === val ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-gray-400 hidden sm:block">
              Klik baris resi → detail &amp; foto · ✏️ edit · 🏷 Label untuk cetak
            </span>
          </div>
        )}

        {/* Daftar resi */}
        {showParcels && (
          parcels.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Belum ada resi di batch ini</p>
          ) : groupMode ? (
            <div className="divide-y divide-gray-100">
              {groups.map(g => {
                const open = openOwner === g.key;
                return (
                  <div key={g.key}>
                    <button
                      onClick={() => setOpenOwner(open ? null : g.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-matcha-50/60 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        g.owner ? 'bg-gradient-to-br from-matcha-400 to-matcha-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {g.owner ? (g.owner.label[0] || '?').toUpperCase() : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {g.owner ? g.owner.label : 'Tanpa Pemilik'}
                          {g.owner?.matched_by_name && (
                            <span className="ml-1.5 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              cocok nama
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {g.owner ? g.owner.code : 'belum di-assign'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-matcha-700">{g.parcels.length} resi</p>
                        <p className="text-[11px] text-gray-400">{formatMulti(g.totals)}</p>
                      </div>
                      <span className={`text-gray-300 text-sm flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {open && (
                      <div className="bg-cream-50/40 divide-y divide-gray-100 border-t border-gray-100">
                        {g.parcels.map(parcelRow)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">{paged.items.map(parcelRow)}</div>
              <Pager paged={paged} className="px-4 py-2.5 border-t border-gray-100" />
            </>
          )
        )}
      </div>

      {showAdd && (
        <AddParcelModal
          type={type}
          batchId={batch.id}
          feePerGram={feePerGram}
          feeCurrency={feeCurrency}
          fineAmount={Number(batch.fine_amount ?? 2000)}
          unboxingFee={Number(batch.unboxing_fee ?? 0.75)}
          batchNumber={batch.batch_number}
          onClose={() => setShowAdd(false)}
          onAdded={parcel => { onParcelAdded?.(batch.id, parcel); setShowAdd(false); }}
        />
      )}

      {editingParcel && (
        <AddParcelModal
          type={type}
          parcel={editingParcel}
          feePerGram={feePerGram}
          feeCurrency={feeCurrency}
          fineAmount={Number(batch.fine_amount ?? 2000)}
          unboxingFee={Number(batch.unboxing_fee ?? 0.75)}
          batchNumber={batch.batch_number}
          onClose={() => setEditingParcel(null)}
          onEdited={updated => { onParcelEdited?.(batch.id, updated); setEditingParcel(null); }}
        />
      )}

      {showLabels && (
        <LabelPrintModal
          parcels={parcels.filter(p => picked.has(p.id))}
          unboxingFee={Number(batch.unboxing_fee ?? 0.75)}
          batchNumber={batch.batch_number}
          type={type}
          onClose={() => setShowLabels(false)}
        />
      )}

      {detailParcel && (
        <ParcelDetailModal
          parcel={detailParcel}
          type={type}
          isAdmin={true}
          onClose={() => setDetailParcel(null)}
        />
      )}
    </>
  );
}

/* ── Satu baris resi ─────────────────────────────────────── */
function ParcelRow({ parcel: p, type, readOnly, showOwner, selectable, selected, onToggle, onOpen, onEdit, onDelete }) {
  const fee = baseFee(p, type);
  const extra = Number(p.additional_fee) || 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${selected ? 'bg-matcha-50' : 'hover:bg-gray-50'}`}
      onClick={selectable ? onToggle : onOpen}
    >
      {selectable && (
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          selected ? 'bg-matcha-700 border-matcha-700' : 'border-gray-300 bg-white'
        }`}>
          {selected && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
      )}
      {/* Foto */}
      <div className="flex gap-1 flex-shrink-0">
        {p.photo_url ? (
          <img src={p.photo_url} alt="arrival" title="Foto Arrival" className="w-11 h-11 object-cover rounded-lg border border-gray-100" />
        ) : (
          <div className="w-11 h-11 bg-cream-100 rounded-lg flex items-center justify-center text-gray-300 border border-gray-100">📦</div>
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
          {showOwner && (
            p.owner ? (
              <span className="text-xs bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full border border-sky-100">
                👤 {p.owner.label}
              </span>
            ) : (
              <span className="text-xs bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-200">
                👤 tanpa pemilik
              </span>
            )
          )}
          {p.estimated_weight_grams > 0 && (
            <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{p.estimated_weight_grams}g</span>
          )}
          {type === 'HC' && p.estimated_quantity > 1 && (
            <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">{p.estimated_quantity} pcs</span>
          )}
          {fee > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
              {money(fee, p.currency)}
            </span>
          )}
          {extra > 0 && (
            <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full border border-orange-100">
              ➕ {money(extra, p.currency)}
            </span>
          )}
          {p.paid_at && (
            <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full border border-green-300 font-semibold" title="Sudah dibayar">
              ✓ Lunas
            </span>
          )}
          {p.need_unboxing && (
            <span className="text-xs bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded-full border border-violet-300 font-semibold" title="Pelanggan minta video unboxing">
              🎥 Unboxing{p.unboxing_fee > 0 ? ` ¥${Number(p.unboxing_fee).toLocaleString('id-ID')}` : ''}
            </span>
          )}
          {p.is_manual_input && (
            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full border border-amber-300 font-semibold" title="Resi ini diketik manual">
              ✍️ Manual
            </span>
          )}
          {p.fine_amount > 0 && (
            <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">⚠️ {rupiah(p.fine_amount)}</span>
          )}
        </div>
      </div>

      {/* Aksi */}
      {!readOnly && !selectable && (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-matcha-700 hover:bg-matcha-50 transition-colors p-1.5 rounded-lg"
            title="Edit resi — berat, biaya, pemilik, foto"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors p-1.5 rounded-lg"
            title="Hapus resi"
          >
            🗑
          </button>
          <span className="text-gray-300 text-lg pl-0.5" title="Klik baris untuk lihat detail">›</span>
        </div>
      )}
    </div>
  );
}
