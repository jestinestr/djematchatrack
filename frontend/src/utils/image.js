// Perkecil foto dari kamera ponsel sebelum diunggah.
//
// Foto HP biasanya 3–8 MB, sementara backend (batas Vercel) hanya menerima
// 4 MB. Di sini gambar dikecilkan dulu di browser: sisi terpanjang dipotong
// ke `maxSize` piksel lalu dikodekan ulang jadi JPEG. Hasilnya biasanya
// 200–600 KB — cukup tajam untuk cek koper, dan jauh lebih cepat terkirim
// lewat data seluler.
const MAX_BYTES = 3.6 * 1024 * 1024; // sisakan ruang untuk overhead multipart

function readAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak terbaca')); };
    img.src = url;
  });
}

const toBlob = (canvas, quality) =>
  new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function compressImage(file, { maxSize = 1600, quality = 0.82 } = {}) {
  if (!file || !file.type.startsWith('image/')) return file;
  // Sudah kecil dan bukan format aneh — kirim apa adanya
  if (file.size <= 900 * 1024 && file.type === 'image/jpeg') return file;

  try {
    const img = await readAsImage(file);
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    let q = quality;
    let blob = await toBlob(canvas, q);
    // Masih kegedean (foto sangat detail) — turunkan mutu bertahap
    while (blob && blob.size > MAX_BYTES && q > 0.4) {
      q -= 0.15;
      blob = await toBlob(canvas, q);
    }
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file; // gagal dikecilkan — biar backend yang menolak kalau kebesaran
  }
}

export const humanSize = bytes =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
