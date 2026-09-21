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

  const packages = [...byId.values()].map(p => ({
    ...p,
    overflow: Math.max(0, p.used - p.quota),
    remaining: Math.max(0, p.quota - p.used),
  }));
  return { packages, parcelInfo };
}

// Tempelkan info paket (pkg) ke daftar resi WH
function attachPackage(parcels, parcelInfo) {
  return (parcels || []).map(p => {
    const info = parcelInfo.get(String(p.id));
    return info ? { ...p, pkg: info } : p;
  });
}

module.exports = { activePackageId, loadPackageInfo, attachPackage };
