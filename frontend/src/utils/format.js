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

export async function downloadImage(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
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
    await downloadImage(items[i].url, items[i].filename);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 400));
  }
}
