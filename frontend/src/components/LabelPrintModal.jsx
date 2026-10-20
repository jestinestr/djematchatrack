import { useState } from 'react';

import { LABEL_SIZES, labelPad, bacaGeser, simpanGeser, GESER_BATAS, ownerOnly, labelToday } from '../utils/label';

// Ukuran label dan aturan penulisan nama ada di utils/label.js.
export { LABEL_SIZES };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

// 4 angka terakhir dicetak tebal
function resiHTML(tn) {
  const s = String(tn || '').trim();
  if (s.length <= 4) return `<b>${esc(s)}</b>`;
  return `${esc(s.slice(0, -4))}<b>${esc(s.slice(-4))}</b>`;
}

// Cetak tanpa membuka tab baru: labelnya ditaruh di bingkai tersembunyi
// lalu dialog cetak langsung muncul di atas halaman ini. Bonusnya, pemblokir
// popup tidak ikut campur dan admin tidak perlu menutup tab sisa.
function cetakDiam(html) {
  const bingkai = document.createElement('iframe');
  bingkai.setAttribute('aria-hidden', 'true');
  bingkai.style.cssText =
    'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden';
  document.body.appendChild(bingkai);

  const buang = () => { if (bingkai.parentNode) bingkai.remove(); };
  const jalan = () => {
    const w = bingkai.contentWindow;
    if (!w) return buang();
    w.onafterprint = buang;          // dibuang begitu dialognya ditutup
    setTimeout(buang, 60_000);       // jaring pengaman kalau dialognya digantung
    w.focus();
    w.print();
  };

  const d = bingkai.contentWindow?.document;
  if (!d) { buang(); return; }
  d.open();
  d.write(html);
  d.close();
  // Tunggu isinya terbentuk dulu, kalau tidak halamannya tercetak kosong
  if (d.readyState === 'complete') setTimeout(jalan, 200);
  else bingkai.onload = () => setTimeout(jalan, 200);
}

export default function LabelPrintModal({ parcels, ownerName, type, onClose, onPrinted }) {
  const [size, setSize] = useState('40x30');
  const [geser, setGeser] = useState(() => bacaGeser('40x30'));
  const [rows, setRows] = useState(() =>
    parcels.map(p => ({
      id: p.id,
      owner: p.owner?.label || ownerName || '',
      name: p.recipient_name || '',
      resi: p.tracking_number || '',
    }))
  );

  function setRow(id, patch) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }

  const today = labelToday();

  // Tiap printer mencetak sedikit meleset — Niimbot B1 pas, P50 Ningyou
  // perlu digeser lagi ke kanan. Angkanya diingat per ukuran label.
  function aturGeser(v) {
    const batas = Math.min(GESER_BATAS.max, Math.max(GESER_BATAS.min, Math.round(v * 10) / 10));
    setGeser(batas);
    simpanGeser(size, batas);
  }

  function print() {
    const s = LABEL_SIZES[size];
    const pad = labelPad(s, geser);
    const labels = rows.map(r => {
      // Nama pengguna sama dengan penerima → cukup satu baris nama
      const body = ownerOnly(r) || !r.owner
        ? `<div class="name">${esc(r.owner || r.name)}</div>`
        : `<div class="owner">${esc(r.owner)}</div>
           <div class="name">${esc(r.name)}</div>`;
      return `
      <div class="label">
        <div class="body">
          ${body}
          <div class="resi">${resiHTML(r.resi)}</div>
        </div>
        <div class="date">${esc(today)}</div>
      </div>`;
    }).join('');

    const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<title>Label ${esc(type || '')} ${esc(s.label)}</title>
<style>
  @page { size: ${s.w}mm ${s.h}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e5e5e5; }
  .label {
    width: ${s.w}mm; height: ${s.h}mm;
    padding: 1.2mm ${pad.kanan}mm 1.2mm ${pad.kiri}mm;
    display: flex; flex-direction: column; justify-content: center;
    text-align: center; overflow: hidden; background: #fff; position: relative;
    font-family: "Arial Narrow", Arial, Helvetica, sans-serif; color: #000;
    page-break-after: always; break-after: page;
    margin: 0 auto 4mm; box-shadow: 0 0 0 1px #bbb;
  }
  .label:last-child { page-break-after: auto; break-after: auto; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: .3mm; }
  .owner { font-size: ${s.owner}pt; line-height: 1.1; color: #333;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name  { font-size: ${s.name}pt; line-height: 1.15; font-weight: 700;
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .resi  { font-size: ${s.resi}pt; line-height: 1.15; font-weight: ${s.resiBobot};
           letter-spacing: .01em; word-break: break-all; margin-top: .4mm; }
  .resi b { font-size: ${s.resiTail}pt; font-weight: ${s.resiEkorBobot}; }
  .date  { position: absolute; right: ${pad.tanggalKanan}mm; bottom: .8mm;
           font-size: ${s.date}pt; color: #555; }
  @media print {
    html, body { background: #fff; }
    .label { margin: 0; box-shadow: none; }
  }
</style></head><body>${labels}</body></html>`;

    // Setiap jalur cetak harus mencatat sendiri — dulu hanya tombol di tabel
    // yang melapor, jadi label yang dicetak dari kartu box atau form edit
    // keluar fisiknya tapi tidak tercatat, dan penanda urutan tidak pernah
    // bisa lepas. Kolom open_printed hanya ada di resi WH, jadi dikirim ke sana.
    const ids = rows.map(r => r.id).filter(Boolean);
    fetch('/api/photos/mark/printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'wh', ids }),
    }).catch(() => {}).finally(() => onPrinted?.(ids));

    cetakDiam(html);
  }

  const s = LABEL_SIZES[size];
  const pad = labelPad(s, geser);
  const px = mm => `${mm * 3.78}px`;
  const first = rows[0];
  const firstSame = first && (ownerOnly(first) || !first.owner);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Judul */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-800">Cetak Label</h2>
            <p className="text-xs text-slate-500">{rows.length} label · bisa diedit sebelum dicetak</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white">×</button>
        </div>

        {/* Ukuran + pratinjau */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500">Ukuran:</span>
          {Object.entries(LABEL_SIZES).map(([key, v]) => (
            <button
              key={key}
              onClick={() => { setSize(key); setGeser(bacaGeser(key)); }}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold border transition-colors ${
                size === key
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
              }`}
            >
              {v.label}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-200">
            <span className="text-xs text-slate-500" title="Geser isi label ke kiri/kanan — tiap printer meleset beda-beda">
              Geser
            </span>
            <button
              onClick={() => aturGeser(geser - GESER_BATAS.langkah)}
              disabled={geser <= GESER_BATAS.min}
              className="w-6 h-6 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 leading-none"
              title="Geser ke kiri"
            >
              ←
            </button>
            <span className="text-xs font-bold text-slate-700 w-14 text-center tabular-nums">
              {geser > 0 ? '+' : ''}{geser.toFixed(1)} mm
            </span>
            <button
              onClick={() => aturGeser(geser + GESER_BATAS.langkah)}
              disabled={geser >= GESER_BATAS.max}
              className="w-6 h-6 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 leading-none"
              title="Geser ke kanan"
            >
              →
            </button>
            {geser !== (LABEL_SIZES[size].nudge || 0) && (
              <button onClick={() => aturGeser(LABEL_SIZES[size].nudge || 0)}
                className="text-[10px] text-slate-400 hover:text-slate-600 underline ml-0.5">
                reset
              </button>
            )}
          </div>

          <div className="flex-1" />
          {first && (
            <div
              className="relative flex flex-col justify-center text-center border border-slate-300 bg-white overflow-hidden flex-shrink-0"
              style={{ width: px(s.w), height: px(s.h), fontFamily: 'Arial Narrow, Arial, sans-serif',
                       padding: `1.2mm ${pad.kanan}mm 1.2mm ${pad.kiri}mm` }}
            >
              {!firstSame && (
                <div style={{ fontSize: `${s.owner}pt`, lineHeight: 1.1, color: '#333' }}>{first.owner}</div>
              )}
              <div style={{ fontSize: `${s.name}pt`, lineHeight: 1.15, fontWeight: 700 }}>
                {firstSame ? (first.owner || first.name) : first.name}
              </div>
              <div style={{ fontSize: `${s.resi}pt`, lineHeight: 1.15, wordBreak: 'break-all',
                            fontWeight: s.resiBobot }}>
                {(first.resi || '').slice(0, -4)}
                <b style={{ fontSize: `${s.resiTail}pt`, fontWeight: s.resiEkorBobot }}>{(first.resi || '').slice(-4)}</b>
              </div>
              <span style={{ position: 'absolute', right: `${pad.tanggalKanan}mm`, bottom: '0.8mm', fontSize: `${s.date}pt`, color: '#555' }}>
                {today}
              </span>
            </div>
          )}
        </div>

        <p className="px-5 pt-3 text-[11px] text-slate-400">
          Geseran diingat per ukuran label di peramban ini — setel sekali sesuai printermu
          (Niimbot B1 dan P50 Ningyou meleset beda-beda), lalu dipakai terus.
        </p>

        <p className="px-5 pt-2 text-xs text-slate-500">
          Label hanya menampilkan satu nama kalau nama penerima sama dengan nama pengguna,
          kosong, atau berpola "J+nama". Selain itu nama pengguna dicetak di atas nama penerima.
        </p>

        {/* Daftar label */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2">
              <span className="text-[10px] font-bold text-slate-400 w-5 flex-shrink-0 text-center">{i + 1}</span>
              <input
                value={r.owner}
                onChange={e => setRow(r.id, { owner: e.target.value })}
                className="input-field text-xs py-1.5 flex-1 min-w-0"
                placeholder="Nama pengguna"
                title="Nama pengguna (akun)"
              />
              <input
                value={r.name}
                onChange={e => setRow(r.id, { name: e.target.value })}
                className="input-field text-xs py-1.5 flex-1 min-w-0"
                placeholder="Nama penerima"
                title="Nama penerima"
              />
              <input
                value={r.resi}
                onChange={e => setRow(r.id, { resi: e.target.value })}
                className="input-field text-xs py-1.5 font-mono flex-1 min-w-0"
                title="Nomor resi"
              />
              <button
                onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}
                className="text-slate-300 hover:text-red-500 transition-colors px-1 flex-shrink-0"
                title="Buang dari cetakan"
              >
                ✕
              </button>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">Tidak ada label tersisa</p>
          )}
        </div>

        {/* Aksi */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Batal</button>
          <button onClick={print} disabled={!rows.length} className="btn-primary flex-1 disabled:opacity-50">
            Cetak {rows.length} Label
          </button>
        </div>
      </div>
    </div>
  );
}
