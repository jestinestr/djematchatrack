import { useEffect, useState } from 'react';
import { fetchAsUser, money } from '../utils/format';

// Pelanggan minta boxnya ditutup dan dikirim.
//
// Dia memilih sendiri resi mana saja yang ikut, mengisi alamat, dan
// menjawab dua hal yang selalu ditanya admin: mau dialihkan ke SF atau
// tidak kalau isinya cairan/baterai/barang mahal, dan perlu asuransi atau
// tidak. Resi yang fotonya belum ada tidak bisa dicentang — barangnya
// belum tentu sudah dicek.
export default function CloseBoxRequest({ parcels = [], boxName, onClose, onSent }) {
  const [pilih, setPilih]   = useState(() => new Set());
  const [form, setForm]     = useState({
    recipient_name: '', phone: '', address: '',
    courier: 'general', sf_ok: false,
    insurance: false, insurance_cny: '', note: '',
  });
  const [kirim, setKirim]   = useState(false);
  const [error, setError]   = useState('');
  const [nunggu, setNunggu] = useState(null); // permintaan yang masih ditinjau

  const siap  = parcels.filter(p => p.photo_url);
  const belum = parcels.filter(p => !p.photo_url);

  useEffect(() => {
    fetchAsUser('/api/box-requests/mine')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setNunggu((d?.requests || []).find(x => x.status === 'pending') || null))
      .catch(() => {});
  }, []);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggle(id) {
    setPilih(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const semua = siap.length > 0 && pilih.size === siap.length;
  function toggleSemua() {
    setPilih(semua ? new Set() : new Set(siap.map(p => p.id)));
  }

  async function kirimPermintaan(e) {
    e.preventDefault();
    if (!pilih.size)          return setError('Pilih dulu resi yang mau dikirim');
    if (!form.address.trim()) return setError('Alamat pengiriman wajib diisi');

    setError(''); setKirim(true);
    try {
      const res = await fetchAsUser('/api/box-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          insurance_cny: form.insurance ? Number(form.insurance_cny) || 0 : 0,
          parcel_ids: [...pilih],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal mengirim permintaan'); return; }
      onSent?.(data);
      onClose();
    } catch {
      setError('Koneksi gagal');
    } finally {
      setKirim(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-matcha-50 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-matcha-800">📮 Minta Tutup Box</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {boxName ? `${boxName} · ` : ''}pilih resi yang mau dikirim, admin yang menyetujui
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors">
            ×
          </button>
        </div>

        {nunggu ? (
          <div className="p-6 text-center space-y-2">
            <div className="text-4xl">⏳</div>
            <p className="text-sm font-bold text-matcha-800">Permintaanmu sedang ditinjau admin</p>
            <p className="text-xs text-gray-500 leading-snug">
              {nunggu.parcel_count} resi · dikirim ke {nunggu.address}
            </p>
            <p className="text-xs text-gray-400">
              Tunggu admin menyetujui dulu ya, baru bisa mengajukan lagi 💚
            </p>
            <button onClick={onClose} className="btn-secondary text-sm px-4 py-2 mt-2">Tutup</button>
          </div>
        ) : (
        <form onSubmit={kirimPermintaan} className="p-5 space-y-4 overflow-y-auto">

          {/* Yang perlu diketahui sebelum mengisi */}
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-xs font-bold text-amber-900">Sebelum mengisi, baca dulu ya 🤍</p>
            <ul className="text-[11px] text-amber-800 leading-relaxed list-disc pl-4 space-y-0.5">
              <li>Resi yang bisa dikirim <b>hanya yang sudah ada foto arrival</b>-nya.</li>
              <li>Permintaan tutup box <b>harus disertai alamat</b> lengkap.</li>
              <li>Pengiriman memakai <b>ekspedisi general</b>.</li>
              <li>
                Barang berupa <b>cairan, baterai, atau barang mahal</b> biasanya tidak diterima
                ekspedisi general dan dialihkan ke <b>SF</b> (ongkirnya lebih mahal).
              </li>
            </ul>
          </div>

          {/* Pilih resi */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 flex-1">
                Resi yang ikut dikirim
              </span>
              {siap.length > 0 && (
                <button type="button" onClick={toggleSemua}
                  className="text-[11px] text-matcha-700 font-semibold hover:underline">
                  {semua ? 'Kosongkan' : 'Pilih semua'}
                </button>
              )}
            </div>

            {!siap.length && (
              <p className="text-xs text-gray-400 mt-2">
                Belum ada resi yang siap dikirim — semuanya masih menunggu foto arrival.
              </p>
            )}

            <div className="space-y-1.5 mt-2">
              {siap.map(p => (
                <label key={p.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                    pilih.has(p.id)
                      ? 'border-matcha-400 bg-matcha-50'
                      : 'border-cream-200 bg-white hover:border-matcha-200'
                  }`}>
                  <input type="checkbox" checked={pilih.has(p.id)} onChange={() => toggle(p.id)} />
                  <span className="font-mono text-xs font-bold text-gray-700 truncate flex-1">
                    {p.tracking_number}
                  </span>
                  <span className="text-[10px] text-green-600 font-semibold flex-shrink-0">📷 ada foto</span>
                </label>
              ))}

              {belum.map(p => (
                <div key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                  <input type="checkbox" disabled className="opacity-40" />
                  <span className="font-mono text-xs text-gray-400 truncate flex-1">
                    {p.tracking_number}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">belum ada foto arrival</span>
                </div>
              ))}
            </div>

            {pilih.size > 0 && (
              <p className="text-[11px] text-matcha-700 font-semibold mt-1.5">
                {pilih.size} resi dipilih
              </p>
            )}
          </div>

          {/* Alamat */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600">Nama penerima</span>
                <input value={form.recipient_name}
                  onChange={e => setField('recipient_name', e.target.value)}
                  placeholder="kosongkan = namamu"
                  className="mt-1 w-full border border-cream-300 rounded-xl px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600">No. HP</span>
                <input value={form.phone} onChange={e => setField('phone', e.target.value)}
                  placeholder="08..."
                  className="mt-1 w-full border border-cream-300 rounded-xl px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">
                Alamat lengkap <span className="text-red-500">*</span>
              </span>
              <textarea rows={3} value={form.address}
                onChange={e => setField('address', e.target.value)}
                placeholder="Jalan, nomor, kelurahan, kecamatan, kota, provinsi, kode pos"
                className="mt-1 w-full border border-cream-300 rounded-xl px-3 py-2 text-sm leading-snug" />
            </label>
          </div>

          {/* Ekspedisi */}
          <div>
            <span className="text-xs font-semibold text-gray-600">Ekspedisi</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { v: 'general', t: 'General', d: 'bawaan, ongkir normal' },
                { v: 'sf', t: 'SF', d: 'lebih mahal, lebih aman' },
              ].map(o => (
                <label key={o.v}
                  className={`px-3 py-2 rounded-xl border cursor-pointer text-center transition-colors ${
                    form.courier === o.v
                      ? 'border-matcha-400 bg-matcha-50'
                      : 'border-cream-200 bg-white hover:border-matcha-200'
                  }`}>
                  <input type="radio" name="courier" className="hidden"
                    checked={form.courier === o.v}
                    onChange={() => setField('courier', o.v)} />
                  <span className="block text-sm font-semibold text-gray-700">{o.t}</span>
                  <span className="block text-[10px] text-gray-400">{o.d}</span>
                </label>
              ))}
            </div>

            <label className="flex items-start gap-2 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={form.sf_ok}
                onChange={e => setField('sf_ok', e.target.checked)} className="mt-0.5" />
              <span className="text-xs text-gray-600 leading-snug">
                Kalau ada <b>cairan, baterai, atau barang mahal</b> yang tidak bisa lewat ekspedisi
                general, <b>boleh dialihkan ke SF</b> walaupun ongkirnya lebih mahal.
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  Tidak dicentang = admin akan menanyakanmu dulu, pengirimannya jadi lebih lama.
                </span>
              </span>
            </label>
          </div>

          {/* Asuransi */}
          <div>
            <label className="flex items-start gap-2 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={form.insurance}
                onChange={e => setField('insurance', e.target.checked)} className="mt-0.5" />
              <span className="text-xs text-gray-600 leading-snug">
                Pakai <b>asuransi</b> pengiriman
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  Biar kalau ada apa-apa di jalan, nilainya bisa diklaim.
                </span>
              </span>
            </label>

            {form.insurance && (
              <label className="flex items-center gap-2 mt-2 pl-3">
                <span className="text-xs text-gray-600">Nilai pertanggungan ¥</span>
                <input type="number" min="0" step="1" value={form.insurance_cny}
                  onChange={e => setField('insurance_cny', e.target.value)}
                  placeholder="0"
                  className="w-28 border border-cream-300 rounded-lg px-2 py-1 text-sm" />
                {Number(form.insurance_cny) > 0 && (
                  <span className="text-[11px] text-gray-400">
                    = {money(Number(form.insurance_cny), 'CNY')}
                  </span>
                )}
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Catatan untuk admin</span>
            <textarea rows={2} value={form.note}
              onChange={e => setField('note', e.target.value)}
              placeholder="opsional — mis. tolong dus digabung, kirim setelah tanggal 20"
              className="mt-1 w-full border border-cream-300 rounded-xl px-3 py-2 text-sm leading-snug" />
          </label>

          {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={kirim || !pilih.size}
              className="btn-primary text-sm px-4 py-2 flex-1 disabled:opacity-50">
              {kirim ? 'Mengirim…' : 'Kirim permintaan'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm px-4 py-2">
              Batal
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
