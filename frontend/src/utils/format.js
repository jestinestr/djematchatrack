// ── Mata uang ───────────────────────────────────────────────────────
export const CURRENCIES = {
  IDR: { symbol: 'Rp', label: 'Rupiah', flag: '🇮🇩' },
  CNY: { symbol: '¥',  label: 'Yuan',   flag: '🇨🇳' },
};

export const normCurrency = c => (String(c).toUpperCase() === 'CNY' ? 'CNY' : 'IDR');

export function money(amount, currency = 'IDR') {
  const cur = normCurrency(currency);
  const n = Number(amount) || 0;
  // Yuan boleh pecahan, Rupiah dibulatkan
  const text = cur === 'CNY'
    ? n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : Math.round(n).toLocaleString('id-ID');
  return `${CURRENCIES[cur].symbol} ${text}`;
}

// Rupiah saja — dipakai untuk denda yang memang selalu IDR
export const rupiah = n => money(n, 'IDR');

// ── Total lintas mata uang ──────────────────────────────────────────
export const baseFee = (p, type) =>
  Number((String(type).toUpperCase() === 'HC' ? p.hc_fee : p.wh_fee) || 0);

// Jumlahkan fee + additional fee per mata uang, denda dipisah (selalu IDR)
export function sumParcels(parcels, type) {
  const out = { IDR: 0, CNY: 0, fine: 0, weight: 0, count: 0 };
  for (const p of parcels || []) {
    const cur = normCurrency(p.currency);
    out[cur] += baseFee(p, type) + (Number(p.additional_fee) || 0);
    out.CNY += Number(p.unboxing_fee) || 0; // video unboxing selalu Yuan
    out.fine += Number(p.fine_amount) || 0;
    out.weight += Number(p.estimated_weight_grams) || 0;
    out.count += 1;
  }
  return out;
}

// "Rp 250.000 + ¥ 120" — hanya mata uang yang ada isinya
export function formatMulti(totals, { empty = '—' } = {}) {
  const parts = [];
  if (totals.IDR) parts.push(money(totals.IDR, 'IDR'));
  if (totals.CNY) parts.push(money(totals.CNY, 'CNY'));
  return parts.length ? parts.join(' + ') : empty;
}

export const formatWeight = g =>
  g >= 1000 ? (g / 1000).toFixed(2) + ' kg' : (g || 0) + ' g';

export function formatDate(str, withTime = true) {
  if (!str) return '-';
  return new Date(str).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

// Hari ke-berapa barang disimpan, dihitung sejak foto arrival diupload.
// endAt: batas akhir (mis. batch selesai dikirim); tanpa itu = sampai hari ini.
export function storageDays(p, endAt) {
  if (!p?.photo_uploaded_at) return null;
  const end = endAt ? new Date(endAt) : new Date();
  return Math.max(1, Math.floor((end - new Date(p.photo_uploaded_at)) / 86400000) + 1);
}

// Warna penanda: makin lama makin mencolok
export const storageTone = d =>
  d >= 30 ? 'bg-red-50 text-red-700 border-red-200'
    : d >= 14 ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';

// ── Sesi user ───────────────────────────────────────────────────────
export const getAccessCode = () => sessionStorage.getItem('access_code') || '';

// fetch yang otomatis membawa kode akses pengguna
export function fetchAsUser(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), 'X-Access-Code': getAccessCode() },
  });
}

// ── Download foto ───────────────────────────────────────────────────
export function slugify(str) {
  return str?.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) || 'foto';
}

// Nama yang dicetak di kartu foto: nama pelanggan, fallback nama penerima
export const cardName = p => p?.owner?.label || p?.recipient_name || '';
export const tail4 = tn => String(tn || '').trim().slice(-4) || '----';

// Susun foto jadi "kartu": foto persegi di atas, nama di kiri bawah,
// 4 digit terakhir resi besar di kanan bawah. Foto asli tidak diubah.
export async function makePhotoCard(url, name, tracking) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Foto gagal dimuat');
  const src = URL.createObjectURL(await res.blob());
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = src;
    });

    const W = 1080, PAD = 60, PH = W - PAD * 2, H = PAD + PH + 260;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Potong tengah supaya foto selalu persegi (seperti object-cover)
    const side = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, PAD, PAD, PH, PH);
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, PH, PH);

    const baseY = PAD + PH + 175;
    const tail = tail4(tracking);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'right';
    ctx.font = '900 150px Arial, Helvetica, sans-serif';
    ctx.fillText(tail, W - PAD, baseY + 20);
    const tailW = ctx.measureText(tail).width;

    ctx.textAlign = 'left';
    ctx.font = 'bold 64px Arial, Helvetica, sans-serif';
    const full = String(name || '').trim();
    let label = full;
    const maxW = W - PAD * 2 - tailW - 40;
    while (label.length > 1 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
    ctx.fillText(label === full ? full : label + '…', PAD + 20, baseY);

    return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92));
  } finally {
    URL.revokeObjectURL(src);
  }
}

// card: { name, tracking } → unduh dalam format kartu; tanpa card → foto asli
export async function downloadImage(url, filename, card) {
  try {
    const blob = card
      ? await makePhotoCard(url, card.name, card.tracking)
      : await (await fetch(url)).blob();
    const ext = blob.type.includes('png') ? '.png' : '.jpg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + ext;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank'); // fallback
  }
}

// Unduh berurutan dengan jeda kecil supaya tidak diblokir browser
export async function downloadMany(items, onProgress) {
  for (let i = 0; i < items.length; i++) {
    await downloadImage(items[i].url, items[i].filename, items[i].card);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
  }
}
