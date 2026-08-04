import { useEffect, useState, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

function formatRupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function BatchTarifCard({ batch, type, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState(batch.fee_per_gram?.toString() || '0');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const parcels    = batch.parcels || [];
  const feePerGram = batch.fee_per_gram || 0;
  const totalWeight = parcels.reduce((s, p) => s + (p.estimated_weight_grams || 0), 0);
  const totalFee    = type === 'HC'
    ? parcels.reduce((s, p) => s + (p.estimated_weight_grams || 0) * feePerGram, 0)
    : parcels.reduce((s, p) => s + (p.wh_fee || 0), 0);
  const isActive = batch.status === 'active';

  // preview while typing
  const previewFee = editing && totalWeight > 0 && Number(input) > 0
    ? totalWeight * Number(input)
    : null;

  async function save() {
    const val = Math.max(0, Math.round(Number(input) || 0));
    setSaving(true);
    const res = await fetch(`/api/batches/${batch.id}/fee`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fee_per_gram: val }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.(batch.id, data.fee_per_gram ?? val);
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-soft overflow-hidden transition-all ${
      isActive ? 'border-matcha-200' : 'border-cream-200'
    }`}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center gap-2 ${
        isActive ? 'bg-matcha-50 border-b border-matcha-100' : 'bg-cream-50 border-b border-cream-200'
      }`}>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
          isActive ? 'bg-matcha-800 text-white' : 'bg-gray-300 text-white'
        }`}>
          Batch #{batch.batch_number}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {isActive ? '● Aktif' : '✓ Selesai'}
        </span>
        <div className="ml-auto flex gap-3 text-xs text-gray-400">
          <span>📦 {parcels.length} resi</span>
          {totalWeight > 0 && (
            <span>⚖️ {totalWeight >= 1000 ? (totalWeight/1000).toFixed(2)+' kg' : totalWeight+' g'}</span>
          )}
        </div>
      </div>

      {/* Tarif section */}
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: current rate display */}
          <div>
            <p className="text-[11px] text-gray-400 font-medium mb-1">Tarif per gram</p>
            {feePerGram > 0 ? (
              <p className="text-xl font-black text-matcha-700">
                {formatRupiah(feePerGram)}<span className="text-sm font-semibold text-matcha-400">/gram</span>
              </p>
            ) : (
              <p className="text-sm text-gray-300 italic">Belum diset</p>
            )}
          </div>

          {/* Right: total fee */}
          {(totalFee > 0 || (previewFee && previewFee > 0)) && (
            <div className="text-right">
              <p className="text-[11px] text-gray-400 font-medium mb-1">
                {type === 'HC' ? 'Est. total fee' : 'Total WH Fee'}
              </p>
              <p className={`text-base font-bold ${previewFee ? 'text-amber-600' : 'text-matcha-700'}`}>
                {previewFee ? formatRupiah(previewFee) : formatRupiah(totalFee)}
                {previewFee && <span className="text-xs text-amber-400 font-normal ml-1">(preview)</span>}
              </p>
              {type === 'HC' && feePerGram > 0 && totalWeight > 0 && !previewFee && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {totalWeight >= 1000 ? (totalWeight/1000).toFixed(2)+' kg' : totalWeight+'g'} × {formatRupiah(feePerGram)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center flex-1 gap-1.5 bg-cream-50 border-2 border-matcha-300 rounded-xl px-3 py-2 focus-within:border-matcha-500 transition-colors">
              <span className="text-xs text-gray-400 shrink-0">Rp</span>
              <input
                type="number" min="0"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
                className="flex-1 text-sm font-mono font-bold bg-transparent outline-none text-matcha-800 min-w-0"
                placeholder="0"
                autoFocus
              />
              <span className="text-xs text-gray-400 shrink-0">/gram</span>
            </div>
            <button onClick={save} disabled={saving}
              className="btn-primary text-sm px-4 py-2 shrink-0 disabled:opacity-50">
              {saving ? 'Simpan...' : 'Simpan'}
            </button>
            <button onClick={() => { setEditing(false); setInput(batch.fee_per_gram?.toString() || '0'); }}
              className="btn-secondary text-sm px-3 py-2 shrink-0">
              Batal
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border-2 transition-all duration-150 ${
                feePerGram > 0
                  ? 'bg-white border-matcha-200 text-matcha-700 hover:bg-matcha-50 hover:border-matcha-400'
                  : 'bg-matcha-800 border-matcha-800 text-white hover:bg-matcha-700 shadow-clay-sm active:shadow-none active:translate-y-[1px]'
              }`}
            >
              {feePerGram > 0 ? '✏️ Ubah Tarif' : '+ Set Tarif'}
            </button>
            {saved && (
              <span className="text-xs text-green-600 font-semibold animate-pop-in">✓ Tersimpan!</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminTarif() {
  const [hcBatches, setHcBatches] = useState([]);
  const [whBatches, setWhBatches] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [hcRes, whRes] = await Promise.all([
      fetch('/api/parcels/hc/all'),
      fetch('/api/parcels/wh/all'),
    ]);
    const [hcData, whData] = await Promise.all([hcRes.json(), whRes.json()]);
    setHcBatches(hcData);
    setWhBatches(whData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSaved(batchId, fee_per_gram, setter) {
    setter(prev => prev.map(b => b.id === batchId ? { ...b, fee_per_gram } : b));
  }

  const hcActive   = hcBatches.filter(b => b.status === 'active');
  const hcArchived = hcBatches.filter(b => b.status !== 'active');
  const whActive   = whBatches.filter(b => b.status === 'active');
  const whArchived = whBatches.filter(b => b.status !== 'active');

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">💰</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Control Tarif</h1>
          <p className="text-sm text-gray-500">Atur tarif per gram untuk setiap batch HC & WH</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Memuat data tarif..." />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">

          {/* ── HC Column ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✈️</span>
              <h2 className="font-bold text-matcha-800">Hand Carry</h2>
              <span className="text-xs text-gray-400 bg-cream-100 border border-cream-300 px-2 py-0.5 rounded-full">
                {hcBatches.length} batch
              </span>
            </div>

            {hcBatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center text-gray-400 text-sm">
                Belum ada batch HC
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active first */}
                {hcActive.map(b => (
                  <BatchTarifCard key={b.id} batch={b} type="HC"
                    onSaved={(id, fee) => handleSaved(id, fee, setHcBatches)} />
                ))}

                {/* Archived - collapsible */}
                {hcArchived.length > 0 && (
                  <ArchivedSection batches={hcArchived} type="HC"
                    onSaved={(id, fee) => handleSaved(id, fee, setHcBatches)} />
                )}
              </div>
            )}
          </div>

          {/* ── WH Column ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🏭</span>
              <h2 className="font-bold text-matcha-800">Warehouse</h2>
              <span className="text-xs text-gray-400 bg-cream-100 border border-cream-300 px-2 py-0.5 rounded-full">
                {whBatches.length} batch
              </span>
            </div>

            {whBatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-cream-200 p-8 text-center text-gray-400 text-sm">
                Belum ada batch WH
              </div>
            ) : (
              <div className="space-y-3">
                {whActive.map(b => (
                  <BatchTarifCard key={b.id} batch={b} type="WH"
                    onSaved={(id, fee) => handleSaved(id, fee, setWhBatches)} />
                ))}

                {whArchived.length > 0 && (
                  <ArchivedSection batches={whArchived} type="WH"
                    onSaved={(id, fee) => handleSaved(id, fee, setWhBatches)} />
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function ArchivedSection({ batches, type, onSaved }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-xs text-gray-400 hover:text-gray-600 flex items-center gap-2 py-1.5 transition-colors"
      >
        <span className="flex-1 border-t border-dashed border-gray-200" />
        <span>{open ? '▲' : '▼'} {batches.length} batch arsip</span>
        <span className="flex-1 border-t border-dashed border-gray-200" />
      </button>
      {open && (
        <div className="space-y-3 mt-1">
          {batches.map(b => (
            <BatchTarifCard key={b.id} batch={b} type={type} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
