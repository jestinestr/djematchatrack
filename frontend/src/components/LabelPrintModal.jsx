import { useState } from 'react';

// Ukuran label (mm) + skala font yang pas untuk tiap ukuran
export const LABEL_SIZES = {
  '30x20': { w: 30, h: 20, label: '30 × 20 mm', batch: 4.5, name: 6,   resi: 9  },
  '40x30': { w: 40, h: 30, label: '40 × 30 mm', batch: 6,   name: 8.5, resi: 13 },
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

// 4 angka terakhir dicetak tebal
function resiHTML(tn) {
  const s = String(tn || '').trim();
  if (s.length <= 4) return `<b>${esc(s)}</b>`;
  return `${esc(s.slice(0, -4))}<b>${esc(s.slice(-4))}</b>`;
}

export default function LabelPrintModal({ parcels, batchNumber, type, onClose }) {
  const [size, setSize] = useState('30x20');
  const [rows, setRows] = useState(() =>
    parcels.map(p => ({
      id: p.id,
      batch: `Batch #${batchNumber}`,
      name: p.recipient_name || '',
      resi: p.tracking_number || '',
    }))
  );

  function setRow(id, patch) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }

  function print() {
    const s = LABEL_SIZES[size];
    const labels = rows.map(r => `
      <div class="label">
        <div class="batch">${esc(r.batch)}</div>
        <div class="name">${esc(r.name)}</div>
        <div class="resi">${resiHTML(r.resi)}</div>
      </div>`).join('');

    const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Label ${esc(type)} ${esc(s.label)}</title>
<style>
  @page { size: ${s.w}mm ${s.h}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e5e5e5; }
  .label {
    width: ${s.w}mm; height: ${s.h}mm; padding: 1mm 1.5mm;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; overflow: hidden; background: #fff;
    font-family: "Arial Narrow", Arial, Helvetica, sans-serif; color: #000;
    page-break-after: always; break-after: page;
    margin: 0 auto 4mm; box-shadow: 0 0 0 1px #bbb;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .batch { font-size: ${s.batch}pt; line-height: 1.1; letter-spacing: .02em; }
  .name  { font-size: ${s.name}pt; line-height: 1.15; font-weight: 600;
           max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .resi  { font-size: ${s.resi}pt; line-height: 1.15; font-weight: 500;
           letter-spacing: .02em; margin-top: .4mm; word-break: break-all; }
  .resi b { font-weight: 900; }
  @media print {
    html, body { background: #fff; }
    .label { margin: 0; box-shadow: none; }
  }
</style></head><body>${labels}</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const s = LABEL_SIZES[size];
  // Pratinjau pada layar: 1mm ≈ 3.78px
  const px = mm => `${mm * 3.78}px`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-matcha-50">
          <div>
            <h2 className="text-base font-bold text-matcha-800">🏷 Cetak Label</h2>
            <p className="text-xs text-gray-500">{rows.length} label · bisa diedit sebelum dicetak</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white">×</button>
        </div>

        {/* Pilih ukuran */}
        <div className="px-5 py-3 border-b border-cream-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500">Ukuran:</span>
          {Object.entries(LABEL_SIZES).map(([key, v]) => (
            <button
              key={key}
              onClick={() => setSize(key)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold border-2 transition-colors ${
                size === key
                  ? 'bg-matcha-800 text-white border-matcha-800'
                  : 'bg-white text-gray-500 border-cream-300 hover:border-matcha-300'
              }`}
            >
              {v.label}
            </button>
          ))}
          <div className="flex-1" />
          {/* Pratinjau ukuran asli */}
          <div
            className="flex flex-col items-center justify-center text-center border border-gray-300 bg-white overflow-hidden flex-shrink-0"
            style={{ width: px(s.w), height: px(s.h), padding: '1mm 1.5mm', fontFamily: 'Arial Narrow, Arial, sans-serif' }}
          >
            <div style={{ fontSize: `${s.batch}pt`, lineHeight: 1.1 }}>{rows[0]?.batch}</div>
            <div style={{ fontSize: `${s.name}pt`, lineHeight: 1.15, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {rows[0]?.name}
            </div>
            <div style={{ fontSize: `${s.resi}pt`, lineHeight: 1.15, wordBreak: 'break-all' }}>
              {(rows[0]?.resi || '').slice(0, -4)}
              <b style={{ fontWeight: 900 }}>{(rows[0]?.resi || '').slice(-4)}</b>
            </div>
          </div>
        </div>

        {/* Daftar label (editable) */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 bg-cream-50 border border-cream-200 rounded-xl px-2.5 py-2">
              <span className="text-[10px] font-bold text-gray-400 w-5 flex-shrink-0 text-center">{i + 1}</span>
              <input
                value={r.batch}
                onChange={e => setRow(r.id, { batch: e.target.value })}
                className="input-field text-xs py-1.5 w-24 flex-shrink-0"
                title="Baris atas"
              />
              <input
                value={r.name}
                onChange={e => setRow(r.id, { name: e.target.value })}
                className="input-field text-xs py-1.5 flex-1 min-w-0"
                title="Nama"
              />
              <input
                value={r.resi}
                onChange={e => setRow(r.id, { resi: e.target.value })}
                className="input-field text-xs py-1.5 font-mono flex-1 min-w-0"
                title="Nomor resi"
              />
              <button
                onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}
                className="text-gray-300 hover:text-red-500 transition-colors px-1 flex-shrink-0"
                title="Buang dari cetakan"
              >
                ✕
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Tidak ada label tersisa</p>
          )}
        </div>

        {/* Aksi */}
        <div className="px-5 py-4 border-t border-cream-200 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button onClick={print} disabled={!rows.length} className="btn-primary flex-1 disabled:opacity-50">
            🖨 Cetak {rows.length} Label
          </button>
        </div>
      </div>
    </div>
  );
}
