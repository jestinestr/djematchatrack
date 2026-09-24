// "Apa yang baru sejak terakhir aku buka" untuk panel pelanggan.
//
// Waktu kunjungan terakhir disimpan per kode akses di perangkat pelanggan
// (localStorage) — tidak perlu kolom baru di database, dan tiap orang punya
// catatan sendiri di HP-nya masing-masing.
//
// Yang dihitung baru: resi yang masuk setelah kunjungan terakhir, dan foto
// arrival yang diunggah setelah itu.

const KEY = code => `last_seen_${String(code || '').trim().toLowerCase()}`;

const safe = fn => { try { return fn(); } catch { return null; } };

export const readLastSeen = code => {
  const raw = safe(() => localStorage.getItem(KEY(code)));
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : null;
};

export const writeLastSeen = (code, when = new Date()) =>
  safe(() => localStorage.setItem(KEY(code), new Date(when).toISOString()));

const after = (value, since) => {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) && t > since;
};

// parcels: seluruh resi milik pelanggan (dari semua batch/box)
export function collectUpdates(parcels, since) {
  if (!since) return { fresh: [], photos: [], total: 0 };

  const fresh = [];   // resi yang baru masuk
  const photos = [];  // resi lama yang fotonya baru diunggah

  for (const p of parcels) {
    if (after(p.created_at, since)) fresh.push(p);
    else if (after(p.photo_uploaded_at, since)) photos.push(p);
  }

  return { fresh, photos, total: fresh.length + photos.length };
}

// Penanda "baru" di kartu resi
export const isFresh = (parcel, since) =>
  !!since && (after(parcel.created_at, since) || after(parcel.photo_uploaded_at, since));

// "2 hari lalu", "kemarin", "tadi" — untuk kalimat sapaan
export function sinceText(ms) {
  if (!ms) return '';
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'kemarin';
  if (days < 30) return `${days} hari lalu`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'sebulan lalu' : `${months} bulan lalu`;
}
