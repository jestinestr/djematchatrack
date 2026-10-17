import { useEffect, useState } from 'react';
import { rupiah } from '../utils/format';

// Input resi massal untuk satu pelanggan — maksimal 5 resi sekali kirim.
//
// Dipakai waktu barang sudah sampai tapi pelanggannya belum setor resi, jadi
// admin mengetiknya sendiri. Karena itu bawaannya:
//   · pemiliknya satu orang untuk semua baris,
//   · jenis resi "barang" (yang paling sering),
//   · tandanya "input manual", yang otomatis kena denda kalau sakelar
//     dendanya nyala di Control Tarif.
const MAKS = 5;
const kosong = () => ({ tracking_number: '', parcel_type: 'barang' });

export default function BulkAddParcel({ batchId, unitFee = 1.5, onClose, onAdded }) {
  const [codes, setCodes] = useState([]);
  const [pkgs, setPkgs]   = useState([]);
  const [ownerId, setOwnerId] = useState('');
  const [manual, setManual]   = useState(true);
  const [rows, setRows]   = useState([kosong(), kosong(), kosong()]);
  const [fine, setFine]   = useState({ manual_fine_on: false, manual_fine_amount: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [hasil, setHasil]   = useState(null); // { ok: [...], gagal: [...] }

  useEffect(() => {
    fetch('/api/codes').then(r => r.json()).then(d => setCodes(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/packages').then(r => r.json())
      .then(d => setPkgs(Array.isArray(d) ? d.filter(p => p.status === 'active') : []))
      .catch(() => {});
    fetch('/api/settings/public').then(r => r.json()).then(d => d && setFine(d)).catch(() => {});
  }, []);

  const owner = codes.find(c => String(c.id) === String(ownerId));
  const pkg   = pkgs.find(p => String(p.owner_code_id) === String(ownerId));
  const isi   = rows.filter(r => r.tracking_number.trim());
  const dendaNyala = manual && fine.manual_fine_on && fine.manual_fine_amount > 0;

  function setRow(i, patch) {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  // Tempel beberapa resi sekaligus: satu baris teks jadi satu baris isian
  function tempel(i, e) {
    const teks = e.clipboardData.getData('text') || '';
    const potong = teks.split(/[\r\n\t,;]+/).map(t => t.trim()).filter(Boolean);
    if (potong.length < 2) return;             // tempelan biasa, biarkan saja
    e.preventDefault();
    setRows(rs => {
      const next = [...rs];
      potong.forEach((nomor, k) => {
        const at = i + k;
        if (at >= MAKS) return;
        next[at] = { ...(next[at] || kosong()), tracking_number: nomor };
      });
      return next.slice(0, MAKS);
    });
  }

  async function simpan(e) {
    e.preventDefault();
    if (!ownerId)    return setError('Pilih pelanggannya dulu');
    if (!isi.length) return setError('Isi minimal satu nomor resi');

    setError(''); setSaving(true);
    const ok = [], gagal = [];

    // Dikirim satu per satu supaya resi yang gagal tidak menjatuhkan yang
    // lain — nomor ganda di satu kiriman pun ketahuan per barisnya.
    for (const r of isi) {
      const fd = new FormData();
      fd.append('batch_id', batchId);
      fd.append('tracking_number', r.tracking_number.trim());
      fd.append('recipient_name', owner?.label || '');
      fd.append('type', r.parcel_type);
      fd.append('currency', 'CNY');
      fd.append('owner_code_id', ownerId);
      fd.append('is_manual_input', manual ? 'true' : 'false');
      fd.append('wh_fee', pkg && pkg.remaining > 0 ? '0' : String(unitFee));
      fd.append('estimated_quantity', '1');
      try {
        const res = await fetch('/api/parcels/wh', { method: 'POST', body: fd });
        const data = await res.json();
        if (res.ok) ok.push(data);
        else gagal.push({ nomor: r.tracking_number.trim(), pesan: data.error || 'gagal' });
      } catch {
        gagal.push({ nomor: r.tracking_number.trim(), pesan: 'koneksi gagal' });
      }
    }

    setSaving(false);
    setHasil({ ok, gagal });
    if (ok.length) onAdded?.(ok);
    if (!gagal.length) onClose();            // semua masuk, tidak perlu ditahan
    else setRows(gagal.map(g => ({ tracking_number: g.nomor, parcel_type: 'barang' })));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-matcha-800">Input Resi Massal</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Satu pelanggan, maksimal {MAKS} resi sekali kirim
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
            ×
          </button>
        </div>

        <form onSubmit={simpan} className="p-5 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Pelanggan</span>
            <select
              value={ownerId} onChange={e => setOwnerId(e.target.value)}
              className="mt-1 w-full border border-cream-300 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">— pilih pelanggan —</option>
              {codes.map(c => (
                <option key={c.id} value={c.id}>{c.label} ({c.code})</option>
              ))}
            </select>
          </label>
          {pkg && (
            <p className="text-[11px] text-matcha-700 bg-matcha-50 border border-matcha-200 rounded-xl px-3 py-1.5">
              Paket aktif · sisa jatah {pkg.remaining} resi
              {pkg.remaining > 0
                ? ' — biaya resi ini ikut paket (¥0)'
                : ` — jatahnya habis, biaya ¥${unitFee}/resi`}
            </p>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 flex-1">Nomor resi</span>
              <span className="text-[11px] text-gray-400">{isi.length}/{MAKS} terisi</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">
              Bisa tempel banyak nomor sekaligus — satu nomor per baris.
              Jenisnya otomatis <b>Barang</b>.
            </p>

            <div className="space-y-1.5">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-1.5">
                  <span className="text-[11px] font-black text-gray-300 w-3 self-center text-center">{i + 1}</span>
                  <input
                    value={r.tracking_number}
                    onChange={e => setRow(i, { tracking_number: e.target.value })}
                    onPaste={e => tempel(i, e)}
                    placeholder="nomor resi"
                    className="flex-1 min-w-0 border border-cream-300 rounded-xl px-3 py-2 text-sm font-mono"
                  />
                  <select
                    value={r.parcel_type}
                    onChange={e => setRow(i, { parcel_type: e.target.value })}
                    className="border border-cream-300 rounded-xl px-2 py-2 text-xs"
                  >
                    <option value="barang">Barang</option>
                    <option value="paperbased">Paperbased</option>
                  </select>
                  {rows.length > 1 && (
                    <button type="button"
                      onClick={() => setRows(rs => rs.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-500 px-1 text-lg leading-none">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {rows.length < MAKS && (
              <button type="button" onClick={() => setRows(rs => [...rs, kosong()])}
                className="mt-2 text-xs text-matcha-700 font-semibold hover:underline">
                + baris resi
              </button>
            )}
          </div>

          <label className="flex items-start gap-2 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={manual}
              onChange={e => setManual(e.target.checked)} className="mt-0.5" />
            <span className="text-xs text-gray-600 leading-snug">
              Tandai sebagai <b>input manual</b> (resi diketik admin, bukan dari setoran pelanggan)
              {dendaNyala && (
                <span className="block text-amber-700 font-semibold mt-0.5">
                  Kena denda {rupiah(fine.manual_fine_amount)}/resi
                  {isi.length > 0 && ` · total ${rupiah(fine.manual_fine_amount * isi.length)}`}
                </span>
              )}
            </span>
          </label>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
          {hasil?.gagal?.length > 0 && (
            <div className="text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2 space-y-1">
              {hasil.ok.length > 0 && (
                <p className="text-green-700 font-semibold">{hasil.ok.length} resi tersimpan</p>
              )}
              <p className="text-red-700 font-semibold">{hasil.gagal.length} resi gagal:</p>
              {hasil.gagal.map(g => (
                <p key={g.nomor} className="text-red-600">
                  <span className="font-mono">{g.nomor}</span> — {g.pesan}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !isi.length}
              className="btn-primary text-sm px-4 py-2 flex-1 disabled:opacity-50">
              {saving ? 'Menyimpan…' : `Simpan ${isi.length || ''} resi`}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">
              Tutup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
