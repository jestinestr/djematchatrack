import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CURRENCIES, money, rupiah, baseFee, normCurrency,
  formatWeight, formatDate,
} from '../utils/format';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const hasMoney = t => t.fee > 0 || t.additional > 0 || t.fine > 0 || t.unboxing > 0;

export default function AdminInvoice() {
  const [type, setType]       = useState('WH');
  const [batchList, setBatchList] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [drafts, setDrafts]   = useState({});   // ownerId -> {additional_fee, currency, note}
  const [savingId, setSavingId] = useState(null);
  const [chosen, setChosen]   = useState(new Set()); // id resi yang ikut ditagih
  const [payingId, setPayingId] = useState(null);

  // WH memakai box, HC masih memakai batch
  const isBox = type === 'WH';

  useEffect(() => {
    const url = isBox ? '/api/boxes?status=all' : `/api/batches/all/${type}`;
    fetch(url)
      .then(r => r.json())
      .then(list => {
        const rows = (list || []).map(b => (isBox
          ? { id: b.id, label: `${b.owner?.label || '—'} - ${b.name}`, closed: b.status !== 'open' }
          : { id: b.id, label: `Batch #${b.batch_number}`, closed: b.status !== 'active' }));
        setBatchList(rows);
        setBatchId(String(rows?.[0]?.id || ''));
      })
      .catch(() => setBatchList([]));
  }, [type, isBox]);

  // Rekap invoice batch terpilih
  useEffect(() => {
    if (!batchId) { setData(null); return; }
    setLoading(true);
    setSelected(new Set());
    fetch(isBox ? `/api/invoices/box/${batchId}` : `/api/invoices/batch/${batchId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setChosen(unpaidIds(d));
        const next = {};
        for (const c of d.customers || []) {
          if (c.owner) {
            next[c.owner.id] = {
              additional_fee: c.invoice.additional_fee || '',
              currency: normCurrency(c.invoice.additional_fee_currency),
              note: c.invoice.additional_note || '',
            };
          }
        }
        setDrafts(next);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [batchId, isBox]);

  const rawCustomers = data?.customers || [];
  const customers = useMemo(() => rawCustomers.map(c => {
    const picked = c.parcels.filter(p => chosen.has(p.id));
    return {
      ...c,
      allParcels: c.parcels,
      parcels: picked,
      parcel_count: picked.length,
      totals: calcTotals(c, picked, type),
    };
  }), [rawCustomers, chosen, type]);

  function toggleChosen(id) {
    setChosen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Tandai lunas resi terpilih milik satu pelanggan; tagihan berikutnya mulai dari nol
  async function setPaid(c, ids, paid = true) {
    if (!ids.length) return;
    if (paid && !window.confirm(`Tandai ${ids.length} resi milik ${c.owner?.label || 'pelanggan ini'} sudah lunas?`)) return;
    setPayingId(c.owner?.id ?? 'none');
    try {
      const res = await fetch('/api/invoices/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, parcel_ids: ids, paid, batch_id: batchId, owner_code_id: c.owner?.id }),
      });
      if (res.ok) {
        const fresh = await fetch(isBox ? `/api/invoices/box/${batchId}` : `/api/invoices/batch/${batchId}`).then(r => r.json());
        setData(fresh);
        setChosen(unpaidIds(fresh));
      }
    } finally {
      setPayingId(null);
    }
  }
  const batch = data?.batch;
  const invoiceable = customers.filter(c => c.owner);

  const grand = useMemo(() => {
    const t = { IDR: 0, CNY: 0, fine: 0, parcels: 0 };
    for (const c of customers) {
      t.IDR += c.totals.IDR.fee + c.totals.IDR.additional;
      t.CNY += c.totals.CNY.fee + c.totals.CNY.additional + c.totals.CNY.unboxing;
      t.fine += c.totals.IDR.fine;
      t.parcels += c.parcel_count;
    }
    return t;
  }, [customers]);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === invoiceable.length) setSelected(new Set());
    else setSelected(new Set(invoiceable.map(c => c.owner.id)));
  }

  function setDraft(ownerId, patch) {
    setDrafts(prev => ({ ...prev, [ownerId]: { ...prev[ownerId], ...patch } }));
  }

  async function saveAdditional(ownerId) {
    const d = drafts[ownerId] || {};
    setSavingId(ownerId);
    try {
      const res = await fetch(isBox ? `/api/invoices/box/${batchId}/extra` : `/api/invoices/batch/${batchId}/owner/${ownerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additional_fee: Number(d.additional_fee) || 0,
          additional_fee_currency: d.currency || 'IDR',
          additional_note: d.note || '',
        }),
      });
      if (res.ok) {
        // muat ulang supaya total ikut terbarui
        const fresh = await fetch(isBox ? `/api/invoices/box/${batchId}` : `/api/invoices/batch/${batchId}`).then(r => r.json());
        setData(fresh);
      }
    } finally {
      setSavingId(null);
    }
  }

  // ── Cetak ─────────────────────────────────────────────────────────
  function printInvoices() {
    const picked = customers.filter(c => c.owner && selected.has(c.owner.id) && c.parcels.length);
    if (!picked.length) return;
    const html = buildInvoicesHTML(batch, picked, type);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    // Dialog cetak dipanggil dari halamannya sendiri setelah logo termuat
  }

  // ── Export CSV ────────────────────────────────────────────────────
  function downloadCSV(rows, suffix) {
    const csv = rows
      .map(r => r.map(cell => {
        const v = String(cell ?? '');
        return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${suffix}_${type}_batch_${batch?.batch_number || batchId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Rekap per pelanggan
  function exportCSV() {
    const rows = [[
      'Pelanggan', 'Kode Akses', 'Jumlah Resi', 'Resi Input Manual',
      'Biaya Rp', 'Biaya Yuan', 'Denda Rp', 'Total Rp', 'Total Yuan',
    ]];
    let manualAll = 0;
    for (const c of customers) {
      const manual = c.parcels.filter(p => p.is_manual_input).length;
      manualAll += manual;
      rows.push([
        c.owner?.label || 'Tanpa Pemilik',
        c.owner?.code || '-',
        c.parcel_count,
        manual || '',
        c.totals.IDR.fee + c.totals.IDR.additional,
        c.totals.CNY.fee + c.totals.CNY.additional + c.totals.CNY.unboxing,
        c.totals.IDR.fine,
        c.totals.IDR.total,
        c.totals.CNY.total,
      ]);
    }
    rows.push([]);
    rows.push(['TOTAL', '', grand.parcels, manualAll || '', grand.IDR, grand.CNY, grand.fine, grand.IDR + grand.fine, grand.CNY]);
    downloadCSV(rows, 'rekap');
  }

  // Rincian per resi — kolom INPUT MANUAL jadi penanda yang gampang disorot
  function exportDetailCSV() {
    const rows = [[
      'Pelanggan', 'Kode Akses', 'Nomor Resi', 'Nama Penerima', 'Jenis',
      'Input Manual', 'Video Unboxing', 'Berat (g)', 'Biaya', 'Mata Uang', 'Additional Fee', 'Unboxing Yuan', 'Denda Rp',
    ]];
    for (const c of customers) {
      for (const p of c.parcels) {
        rows.push([
          c.owner?.label || 'Tanpa Pemilik',
          c.owner?.code || '-',
          p.tracking_number,
          p.recipient_name,
          p.type === 'paperbased' ? 'Paperbased' : 'Barang',
          p.is_manual_input ? 'MANUAL' : '',
          p.need_unboxing ? 'UNBOXING' : '',
          p.estimated_weight_grams || '',
          baseFee(p, type) || '',
          normCurrency(p.currency),
          p.additional_fee || '',
          p.unboxing_fee || '',
          p.fine_amount || '',
        ]);
      }
    }
    downloadCSV(rows, 'rincian');
  }

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">🧾</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Invoice</h1>
          <p className="text-sm text-gray-500">Buat invoice per pelanggan untuk satu batch</p>
        </div>
      </div>

      {/* Pilih batch */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-3 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
          {['HC', 'WH'].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                type === t ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
              }`}>
              {t === 'HC' ? '✈️ Hand Carry' : '🏭 Warehouse'}
            </button>
          ))}
        </div>

        <select
          value={batchId}
          onChange={e => setBatchId(e.target.value)}
          className="input-field text-sm w-auto py-1.5"
        >
          {batchList.length === 0 && <option value="">{isBox ? 'Belum ada box' : 'Belum ada batch'}</option>}
          {batchList.map(b => (
            <option key={b.id} value={b.id}>{b.label}{b.closed ? ' · ditutup' : ''}</option>
          ))}
        </select>

        <div className="flex-1" />

        <button
          onClick={exportCSV}
          disabled={!customers.length}
          title="Satu baris per pelanggan — total tagihannya"
          className="text-xs px-3 py-1.5 rounded-xl border-2 border-cream-300 bg-white text-gray-600 hover:bg-cream-50 font-semibold transition-colors disabled:opacity-40"
        >
          ⬇️ Rekap CSV
        </button>
        <button
          onClick={exportDetailCSV}
          disabled={!customers.length}
          title="Satu baris per resi, lengkap dengan kolom penanda Input Manual"
          className="text-xs px-3 py-1.5 rounded-xl border-2 border-cream-300 bg-white text-gray-600 hover:bg-cream-50 font-semibold transition-colors disabled:opacity-40"
        >
          ⬇️ Rincian Resi
        </button>
        <button
          onClick={printInvoices}
          disabled={!selected.size}
          className="text-xs px-4 py-1.5 rounded-xl font-semibold bg-matcha-800 hover:bg-matcha-700 text-white shadow-soft transition-colors disabled:opacity-40 disabled:shadow-none"
        >
          🖨 Cetak Invoice {selected.size ? `(${selected.size})` : ''}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Memuat rekap..." />
      ) : !customers.length ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-14 text-center text-gray-400">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-medium">Belum ada resi di batch ini</p>
        </div>
      ) : (
        <>
          {/* Ringkasan batch */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { icon: '👤', label: 'Pelanggan', value: invoiceable.length },
              { icon: '📦', label: 'Total Resi', value: grand.parcels },
              { icon: '💰', label: 'Total Tagihan', value: [grand.IDR ? money(grand.IDR, 'IDR') : null, grand.CNY ? money(grand.CNY, 'CNY') : null].filter(Boolean).join(' + ') || '—' },
              { icon: '⚠️', label: 'Total Denda', value: grand.fine ? rupiah(grand.fine) : '—' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-cream-200 shadow-soft px-3 py-2.5 flex items-center gap-2.5">
                <span className="text-xl">{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">{s.label}</p>
                  <p className="text-sm font-bold text-matcha-800 truncate">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pilih semua */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <button onClick={toggleAll} className="text-xs font-semibold text-matcha-700 hover:underline">
              {selected.size === invoiceable.length ? 'Batal pilih semua' : `Pilih semua (${invoiceable.length})`}
            </button>
            {selected.size > 0 && <span className="text-xs text-gray-400">{selected.size} dipilih</span>}
          </div>

          {/* Daftar pelanggan */}
          <div className="space-y-3">
            {customers.map(c => {
              const key = c.owner ? c.owner.id : '__none__';
              const isSel = c.owner && selected.has(c.owner.id);
              const d = drafts[key] || { additional_fee: '', currency: 'IDR', note: '' };
              return (
                <div key={key}
                  className={`bg-white rounded-2xl border-2 shadow-soft overflow-hidden transition-all ${
                    isSel ? 'border-matcha-400' : 'border-cream-200'
                  }`}>
                  {/* Header pelanggan */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-cream-50 border-b border-cream-100">
                    {c.owner ? (
                      <div
                        onClick={() => toggle(c.owner.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors ${
                          isSel ? 'bg-matcha-700 border-matcha-700' : 'border-gray-300 bg-white hover:border-matcha-400'
                        }`}
                      >
                        {isSel && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    ) : <span className="w-5 flex-shrink-0" />}

                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      c.owner ? 'bg-gradient-to-br from-matcha-400 to-matcha-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {c.owner ? (c.owner.label[0] || '?').toUpperCase() : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-matcha-800 text-sm truncate">
                        {c.owner ? c.owner.label : 'Tanpa Pemilik'}
                      </p>
                      <p className="text-xs text-gray-400 font-mono truncate">
                        {c.owner ? c.owner.code : 'resi belum di-assign ke kode akses'}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{c.parcel_count} dari {c.allParcels.length} resi ditagih</p>
                      <p className="text-sm font-bold text-matcha-700">
                        {[
                          c.totals.IDR.total ? money(c.totals.IDR.total, 'IDR') : null,
                          c.totals.CNY.total ? money(c.totals.CNY.total, 'CNY') : null,
                        ].filter(Boolean).join(' + ') || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Additional fee manual */}
                  {c.owner && (
                    <div className="px-4 py-3 flex flex-wrap items-end gap-2 border-b border-cream-100">
                      <div className="w-32">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                          Additional Fee
                        </label>
                        <input
                          type="number" min="0" step="0.01"
                          value={d.additional_fee}
                          onChange={e => setDraft(key, { additional_fee: e.target.value })}
                          placeholder="0"
                          className="input-field text-sm py-1.5"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Mata Uang</label>
                        <select
                          value={d.currency}
                          onChange={e => setDraft(key, { currency: e.target.value })}
                          className="input-field text-sm py-1.5"
                        >
                          {Object.entries(CURRENCIES).map(([code, cur]) => (
                            <option key={code} value={code}>{cur.symbol} {code}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[140px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Keterangan</label>
                        <input
                          type="text"
                          value={d.note}
                          onChange={e => setDraft(key, { note: e.target.value })}
                          placeholder="cth: biaya packing ulang"
                          className="input-field text-sm py-1.5"
                        />
                      </div>
                      <button
                        onClick={() => saveAdditional(c.owner.id)}
                        disabled={savingId === c.owner.id}
                        className="btn-primary text-xs px-3 py-2 disabled:opacity-50"
                      >
                        {savingId === c.owner.id ? '...' : '💾 Simpan'}
                      </button>
                    </div>
                  )}

                  {/* Rincian resi */}
                  <details className="group">
                    <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-cream-50 transition-colors list-none flex items-center gap-1.5">
                      <span className="group-open:rotate-90 transition-transform">›</span>
                      Pilih resi yang ditagih ({c.parcel_count}/{c.allParcels.length})
                      {c.allParcels.some(p => p.paid_at) && (
                        <span className="ml-1 text-green-600 font-semibold">· {c.allParcels.filter(p => p.paid_at).length} lunas</span>
                      )}
                    </summary>
                    {c.parcels.length > 0 && (
                      <div className="px-4 py-2 border-t border-cream-100 bg-green-50/50 flex items-center gap-2">
                        <span className="text-xs text-gray-500 flex-1">
                          Sudah dibayar? Resi yang ditandai lunas tidak ikut di tagihan berikutnya.
                        </span>
                        <button
                          onClick={() => setPaid(c, c.parcels.map(p => p.id), true)}
                          disabled={payingId === (c.owner?.id ?? 'none')}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex-shrink-0"
                        >
                          ✓ Tandai lunas ({c.parcels.length})
                        </button>
                      </div>
                    )}
                    <div className="divide-y divide-cream-100 border-t border-cream-100">
                      {c.allParcels.map(p => (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-2 ${p.paid_at ? 'bg-green-50/40' : ''}`}>
                          {p.paid_at ? (
                            <button
                              onClick={() => setPaid(c, [p.id], false)}
                              title="Batalkan status lunas"
                              className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-300 px-1.5 py-0.5 rounded-full flex-shrink-0 hover:bg-white"
                            >
                              ✓ Lunas
                            </button>
                          ) : (
                            <input
                              type="checkbox"
                              checked={chosen.has(p.id)}
                              onChange={() => toggleChosen(p.id)}
                              className="w-4 h-4 accent-matcha-700 flex-shrink-0 cursor-pointer"
                              title="Ikut ditagih di invoice ini"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700 truncate">
                              {p.recipient_name}
                              {p.is_manual_input && (
                                <span className="ml-1.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-full align-middle">
                                  ✍️ MANUAL
                                </span>
                              )}
                              {p.need_unboxing && (
                                <span className="ml-1.5 text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-300 px-1.5 py-0.5 rounded-full align-middle">
                                  🎥 UNBOXING {p.unboxing_fee > 0 ? money(p.unboxing_fee, 'CNY') : ''}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] font-mono text-gray-400 truncate">{p.tracking_number}</p>
                          </div>
                          <div className="text-right text-[11px] flex-shrink-0">
                            {baseFee(p, type) > 0 && (
                              <p className="text-amber-600 font-semibold">{money(baseFee(p, type), p.currency)}</p>
                            )}
                            {p.additional_fee > 0 && (
                              <p className="text-orange-500">➕ {money(p.additional_fee, p.currency)}</p>
                            )}
                            {p.fine_amount > 0 && <p className="text-red-500">⚠️ {rupiah(p.fine_amount)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Id semua resi yang belum lunas — pilihan bawaan tiap invoice
function unpaidIds(d) {
  return new Set((d?.customers || []).flatMap(c => c.parcels.filter(p => !p.paid_at).map(p => p.id)));
}

// Hitung ulang total dari resi yang dipilih saja
function calcTotals(c, picked, type) {
  const t = {
    IDR: { fee: 0, additional: 0, fine: 0, unboxing: 0, total: 0 },
    CNY: { fee: 0, additional: 0, fine: 0, unboxing: 0, total: 0 },
  };
  for (const p of picked) {
    const cur = normCurrency(p.currency);
    t[cur].fee += baseFee(p, type);
    t[cur].additional += Number(p.additional_fee) || 0;
    t.IDR.fine += Number(p.fine_amount) || 0;
    t.CNY.unboxing += Number(p.unboxing_fee) || 0;
  }
  // Additional fee manual per pelanggan ikut kalau ada resi yang ditagih
  if (picked.length && Number(c.invoice?.additional_fee)) {
    t[normCurrency(c.invoice.additional_fee_currency)].additional += Number(c.invoice.additional_fee);
  }
  for (const k of ['IDR', 'CNY']) {
    const x = t[k];
    x.total = x.fee + x.additional + x.fine + x.unboxing;
  }
  return t;
}

/* ── Dokumen invoice untuk dicetak ───────────────────────── */
function buildInvoicesHTML(batch, customers, type) {
  const today = formatDate(new Date().toISOString(), false);
  const typeLabel = type === 'HC' ? 'Hand Carry' : 'Warehouse';

  const pages = customers.map(c => {
    const rows = c.parcels.map((p, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>
          <div class="name">${esc(p.recipient_name)}${p.is_manual_input ? ' <span class="tag">MANUAL</span>' : ''}${p.need_unboxing ? ' <span class="tag tag-unbox">UNBOXING</span>' : ''}</div>
          <div class="mono">${esc(p.tracking_number)}</div>
        </td>
        <td>${p.type === 'paperbased' ? 'Paperbased' : 'Barang'}</td>
        <td class="right">${p.estimated_weight_grams ? esc(formatWeight(p.estimated_weight_grams)) : '-'}</td>
        <td class="right">${baseFee(p, type) ? esc(money(baseFee(p, type), p.currency)) : '-'}</td>
        <td class="right">${p.additional_fee ? esc(money(p.additional_fee, p.currency)) : '-'}</td>
        <td class="right">${p.fine_amount ? esc(rupiah(p.fine_amount)) : '-'}</td>
      </tr>`).join('');

    const summaryRows = ['IDR', 'CNY']
      .filter(cur => hasMoney(c.totals[cur]))
      .map(cur => `
        <tr>
          <td>Subtotal biaya (${CURRENCIES[cur].label})</td>
          <td class="right">${esc(money(c.totals[cur].fee, cur))}</td>
        </tr>
        ${c.totals[cur].additional ? `<tr>
          <td>Additional fee (${CURRENCIES[cur].label})${c.invoice.additional_note ? ` — ${esc(c.invoice.additional_note)}` : ''}</td>
          <td class="right">${esc(money(c.totals[cur].additional, cur))}</td>
        </tr>` : ''}
        ${c.totals[cur].unboxing ? `<tr>
          <td>Video unboxing</td>
          <td class="right">${esc(money(c.totals[cur].unboxing, cur))}</td>
        </tr>` : ''}
        ${cur === 'IDR' && c.totals.IDR.fine ? `<tr>
          <td>Denda input manual</td>
          <td class="right">${esc(rupiah(c.totals.IDR.fine))}</td>
        </tr>` : ''}
        <tr class="grand">
          <td>TOTAL ${CURRENCIES[cur].label}</td>
          <td class="right">${esc(money(c.totals[cur].total, cur))}</td>
        </tr>`).join('');

    return `
    <section class="invoice">
      <header>
        <div class="brand">
          <img class="logo" src="${window.location.origin}/ava.png" alt="">
          <div>
            <h1>Djematcha</h1>
            <p class="sub">Invoice ${esc(typeLabel)} · ${esc(batch?.label || 'Batch #' + batch?.batch_number)}</p>
          </div>
        </div>
        <div class="right">
          <p class="sub">Tanggal cetak</p>
          <p class="strong">${esc(today)}</p>
        </div>
      </header>

      <div class="bill">
        <p class="sub">Ditagihkan kepada</p>
        <p class="strong big">${esc(c.owner.label)}</p>
        <p class="mono">${esc(c.owner.code)} · ${c.parcel_count} resi</p>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Penerima / Nomor Resi</th>
            <th>Jenis</th>
            <th class="right">Berat</th>
            <th class="right">Biaya</th>
            <th class="right">Add. Fee</th>
            <th class="right">Denda</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table class="summary">${summaryRows}</table>

      <footer>
        <p>Terima kasih telah menggunakan jasa Djematcha 🍵</p>
      </footer>
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(typeLabel)} Batch ${esc(batch?.batch_number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #1f2937; margin: 0; padding: 24px; background: #f5f5f4; }
  .invoice { background: #fff; padding: 32px; max-width: 800px; margin: 0 auto 24px;
             border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #2A4A40; padding-bottom: 14px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 26px; color: #2A4A40; letter-spacing: -.5px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
          border: 1px solid #e5eee9; flex-shrink: 0; }
  .sub { margin: 2px 0; font-size: 11px; color: #6b7280; }
  .strong { margin: 2px 0; font-weight: 700; font-size: 13px; }
  .big { font-size: 18px; color: #2A4A40; }
  .mono { font-family: ui-monospace, "Courier New", monospace; font-size: 11px; color: #6b7280; }
  .right { text-align: right; }
  .num { text-align: center; width: 28px; color: #9ca3af; }
  .bill { background: #f7faf8; border: 1px solid #e5eee9; border-radius: 8px;
          padding: 12px 14px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  .items th { text-align: left; font-size: 10px; text-transform: uppercase;
              letter-spacing: .04em; color: #6b7280; border-bottom: 1px solid #e5e7eb;
              padding: 6px 8px; }
  .items td { font-size: 12px; padding: 8px; border-bottom: 1px solid #f3f4f6;
              vertical-align: top; }
  .items .name { font-weight: 600; }
  .tag { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .04em;
         background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;
         border-radius: 999px; padding: 0 5px; vertical-align: middle; }
  .tag-unbox { background: #ede9fe; color: #5b21b6; border-color: #c4b5fd; }
  .summary { margin-top: 18px; margin-left: auto; width: 320px; }
  .summary td { font-size: 12px; padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  .summary .grand td { font-weight: 800; font-size: 13px; color: #2A4A40;
                       border-top: 2px solid #2A4A40; border-bottom: none; padding-top: 8px; }
  footer { margin-top: 26px; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print {
    body { background: #fff; padding: 0;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice { box-shadow: none; border-radius: 0; margin: 0; padding: 20px;
               page-break-after: always; max-width: none; }
    .invoice:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>${pages}
<script>
  // Cetak setelah logo selesai dimuat, supaya tidak tercetak kosong
  window.addEventListener('load', () => setTimeout(() => window.print(), 150));
</script>
</body>
</html>`;
}
