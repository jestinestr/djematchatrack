const supabase = require('../supabase');

// Paket aktif milik seorang pelanggan (WH).
//   id        → pelanggan punya paket aktif
//   null      → pelanggan satuan / tanpa pemilik
//   undefined → tabel paket belum ada (migrasi 006 belum dijalankan);
//               pemanggil jangan menyentuh kolom package_id sama sekali
async function activePackageId(ownerCodeId) {
  if (!ownerCodeId) {
    const probe = await supabase.from('customer_packages').select('id').limit(1);
    return probe.error ? undefined : null;
  }
  const { data, error } = await supabase
    .from('customer_packages')
    .select('id')
    .eq('owner_code_id', ownerCodeId)
    .eq('status', 'active')
    .order('period_no', { ascending: false })
    .limit(1);
  if (error) return undefined;
  return data?.[0]?.id ?? null;
}

// Apakah paket masih punya jatah kosong (untuk isi otomatis biaya WH)
async function packageHasRoom(pkgId) {
  if (!pkgId) return false;
  const [{ data: pkg }, { count }] = await Promise.all([
    supabase.from('customer_packages').select('quota').eq('id', pkgId).single(),
    supabase.from('wh_parcels').select('id', { count: 'exact', head: true }).eq('package_id', pkgId),
  ]);
  return !!pkg && (count || 0) < pkg.quota;
}

// Hitung pemakaian tiap paket + nomor urut tiap resi di dalam paketnya.
// Urutan mengikuti waktu resi dibuat: resi ke-(quota+1) dst = kelebihan.
async function loadPackageInfo() {
  const [pk, rows] = await Promise.all([
    supabase.from('customer_packages').select('*'),
    supabase
      .from('wh_parcels')
      .select('id, package_id, created_at')
      .not('package_id', 'is', null)
      .order('created_at', { ascending: true }),
  ]);
  if (pk.error || rows.error) return { packages: [], parcelInfo: new Map() };

  const byId = new Map((pk.data || []).map(p => [String(p.id), { ...p, used: 0 }]));
  const parcelInfo = new Map();

  for (const r of rows.data || []) {
    const p = byId.get(String(r.package_id));
    if (!p) continue;
    p.used += 1;
    parcelInfo.set(String(r.id), {
      package_id: p.id,
      name: p.name,
      period_no: p.period_no,
      quota: p.quota,
      pos: p.used,
      over: p.used > p.quota,
    });
  }

  // Pembayaran (DP/cicilan). Statusnya dihitung dari jumlah bayar vs harga,
  // bukan disimpan sebagai kolom sendiri, supaya tidak pernah ketinggalan
  // zaman waktu ada cicilan baru masuk.
  const pay = await supabase.from('package_payments').select('package_id, amount');
  const paidBy = new Map();
  for (const row of pay.data || []) {
    const key = String(row.package_id);
    paidBy.set(key, (paidBy.get(key) || 0) + Number(row.amount || 0));
  }

  const packages = [...byId.values()].map(p => ({
    ...p,
    overflow: Math.max(0, p.used - p.quota),
    remaining: Math.max(0, p.quota - p.used),
    ...paymentOf(p, paidBy.get(String(p.id)) || 0),
  }));
  return { packages, parcelInfo };
}

// Ringkasan pembayaran satu paket
function paymentOf(pkg, paid) {
  const price = Number(pkg.price || 0);
  const due = Math.max(0, price - paid);
  return {
    price,
    paid,
    due,
    // Tanpa harga, paket tidak bisa dibilang lunas atau belum — biarkan kosong
    payment_status: !price ? 'none' : due <= 0 ? 'lunas' : paid > 0 ? 'dp' : 'belum',
  };
}

// Tempelkan info paket (pkg) ke daftar resi WH
function attachPackage(parcels, parcelInfo) {
  return (parcels || []).map(p => {
    const info = parcelInfo.get(String(p.id));
    return info ? { ...p, pkg: info } : p;
  });
}

module.exports = { activePackageId, packageHasRoom, loadPackageInfo, attachPackage, paymentOf };
