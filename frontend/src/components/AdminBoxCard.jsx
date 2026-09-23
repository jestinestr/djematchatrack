import { useState } from 'react';
import AddParcelModal from './AddParcelModal';
import ParcelDetailModal from './ParcelDetailModal';
import LabelPrintModal from './LabelPrintModal';
import Pager, { usePaged } from './Pager';
import { ParcelRow } from './AdminBatchCard';
import { sumParcels, formatMulti, formatWeight, rupiah } from '../utils/format';

// Satu box milik satu pelanggan. Penanda utamanya "Nama - Box", persis
// seperti yang dilihat pelanggan.
export default function AdminBoxCard({ box, tarif, onChanged, onParcelsChanged }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [open, setOpen] = useState(box.status === 'open');
  const [busy, setBusy] = useState(false);
  const [labelMode, setLabelMode] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [showLabels, setShowLabels] = useState(false);

  const parcels = box.parcels || [];
  const isOpen = box.status === 'open';
  const totals = sumParcels(parcels, 'WH');
  const paged = usePaged(parcels, 10);
  const label = `${box.owner?.label || '—'} - ${box.name}`;

  async function call(url, body) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      if (res.ok) onChanged?.();
      else alert((await res.json()).error || 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const name = window.prompt(`Ganti nama box milik ${box.owner?.label}:`, box.name);
    if (!name?.trim() || name.trim() === box.name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) onChanged?.();
      else alert((await res.json()).error || 'Gagal');
    } finally {
      setBusy(false);
    }
  }

  async function removeParcel(id) {
    if (!window.confirm('Hapus resi ini?')) return;
    const res = await fetch(`/api/parcels/wh/${id}`, { method: 'DELETE' });
    if (res.ok) onParcelsChanged?.();
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden mb-3 ${
        isOpen ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50'
      }`}>
        {/* Kepala box */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 border-b ${
          isOpen ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/70 border-slate-200'
        }`}>
          <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 min-w-0 text-left">
            <span className="text-slate-400 text-xs w-3">{open ? '▾' : '▸'}</span>
            <span className="text-sm font-bold text-slate-800 truncate">{label}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-600'
            }`}>
              {isOpen ? 'Aktif' : 'Ditutup'}
            </span>
            <span className="text-xs text-slate-400 flex-shrink-0">{parcels.length} resi</span>
          </button>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isOpen && (
              <button onClick={() => setShowAdd(true)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                + Resi
              </button>
            )}
            {parcels.length > 0 && (
              <button
                onClick={() => { setLabelMode(v => !v); setPicked(new Set()); setOpen(true); }}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  labelMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}>
                Label
              </button>
            )}
            <button onClick={rename} disabled={busy} title="Ganti nama box"
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50">
              ✏️
            </button>
            {isOpen ? (
              <button
                onClick={() => window.confirm(`Tutup ${label}? Box beserta resinya pindah ke arsip pelanggan.`) && call(`/api/boxes/${box.id}/close`)}
                disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
                Tutup
              </button>
            ) : (
              <button onClick={() => call(`/api/boxes/${box.id}/reopen`)} disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white transition-colors disabled:opacity-50">
                Buka
              </button>
            )}
          </div>
        </div>

        {/* Ringkasan */}
        {open && (
          <div className="px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 border-b border-slate-100">
            {totals.weight > 0 && <span>{formatWeight(totals.weight)}</span>}
            {(totals.IDR > 0 || totals.CNY > 0) && <span className="font-medium text-slate-700">{formatMulti(totals)}</span>}
            {totals.fine > 0 && <span className="text-red-600">Denda {rupiah(totals.fine)}</span>}
            {!isOpen && box.closed_at && (
              <span className="ml-auto text-slate-400">
                Ditutup {new Date(box.closed_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        )}

        {/* Bar cetak label */}
        {open && labelMode && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setPicked(picked.size === parcels.length ? new Set() : new Set(parcels.map(p => p.id)))}
              className="text-xs font-semibold text-slate-700 hover:underline">
              {picked.size === parcels.length ? 'Batal semua' : `Pilih semua (${parcels.length})`}
            </button>
            <span className="text-xs text-slate-500">{picked.size} dipilih</span>
            <div className="flex-1" />
            <button onClick={() => setShowLabels(true)} disabled={!picked.size}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-slate-800 text-white disabled:opacity-40">
              Cetak Label ({picked.size})
            </button>
          </div>
        )}

        {/* Daftar resi */}
        {open && (
          parcels.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">Box ini masih kosong</p>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                {paged.items.map(p => (
                  <ParcelRow
                    key={p.id}
                    parcel={p}
                    type="WH"
                    showOwner={false}
                    storageEnd={box.closed_at}
                    selectable={labelMode}
                    selected={picked.has(p.id)}
                    onToggle={() => setPicked(prev => {
                      const n = new Set(prev);
                      n.has(p.id) ? n.delete(p.id) : n.add(p.id);
                      return n;
                    })}
                    onOpen={() => setDetail(p)}
                    onEdit={() => setEditing(p)}
                    onDelete={() => removeParcel(p.id)}
                  />
                ))}
              </div>
              <Pager paged={paged} className="px-4 py-2.5 border-t border-slate-100" />
            </>
          )
        )}
      </div>

      {showAdd && (
        <AddParcelModal
          type="WH"
          batchId={tarif?.batchId}
          boxId={box.id}
          boxName={label}
          feePerGram={tarif?.fee_per_gram || 0}
          feeCurrency={tarif?.fee_currency || 'CNY'}
          fineAmount={Number(tarif?.fine_amount ?? 2000)}
          unboxingFee={Number(tarif?.unboxing_fee ?? 0.75)}
          unitFee={Number(tarif?.unit_fee ?? 1.5)}
          lockedOwnerId={box.owner?.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); onParcelsChanged?.(); }}
        />
      )}

      {editing && (
        <AddParcelModal
          type="WH"
          parcel={editing}
          boxId={box.id}
          boxName={label}
          feePerGram={tarif?.fee_per_gram || 0}
          feeCurrency={tarif?.fee_currency || 'CNY'}
          fineAmount={Number(tarif?.fine_amount ?? 2000)}
          unboxingFee={Number(tarif?.unboxing_fee ?? 0.75)}
          unitFee={Number(tarif?.unit_fee ?? 1.5)}
          onClose={() => setEditing(null)}
          onEdited={() => { setEditing(null); onParcelsChanged?.(); }}
        />
      )}

      {showLabels && (
        <LabelPrintModal
          parcels={parcels.filter(p => picked.has(p.id))}
          batchNumber={box.name}
          type="WH"
          onClose={() => setShowLabels(false)}
        />
      )}

      {detail && (
        <ParcelDetailModal parcel={detail} type="WH" isAdmin onClose={() => setDetail(null)} />
      )}
    </>
  );
}
