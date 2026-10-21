const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes } = require('../lib/owner');
const { logActivity } = require('../lib/log');
const { closeBox, ensureOpenBox } = require('../lib/box');
const { hasColumn } = require('../lib/columns');

// Permintaan tutup box dari pelanggan.
//
// Pelanggan memilih resi mana saja yang mau dikirim, mengisi alamat, lalu
// admin tinggal menyetujui. Syaratnya resi itu sudah ada foto arrival-nya
// — kalau belum, barangnya belum tentu sudah dicek, jadi tidak boleh ikut.
//
// Selama migrasi 020 belum dijalankan semua route di sini menjawab dengan
// pesan yang menyebut file SQL-nya, dan sisa aplikasi tetap jalan.
const BELUM_AKTIF =
  'Permintaan tutup box belum aktif — jalankan supabase/migrations/020_box_close_requests.sql';

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Pelanggan dikenali dari kode aksesnya, sama seperti setor resi
async function viewerOf(req) {
  const code = (req.get('X-Access-Code') || '').trim();
  if (!code) return null;
  const { data } = await supabase
    .from('access_codes').select('id, label').ilike('code', code).maybeSingle();
  return data || null;
}

// Box yang sebenarnya dipakai resi-resi di satu permintaan.
//
// box_id dicatat saat pelanggan mengajukan, tapi resinya bisa pindah box
// sesudah itu — mis. invoice sebagian ditandai lunas, lalu sisa resinya
// otomatis geser ke box berikutnya. Yang dipakai adalah box tempat resinya
// berada sekarang, supaya yang ditutup memang box yang benar.
function boxSekarang(parcels, fallback = null) {
  const hitung = new Map();
  for (const p of parcels || []) {
    if (!p.box_id) continue;
    hitung.set(String(p.box_id), (hitung.get(String(p.box_id)) || 0) + 1);
  }
  if (!hitung.size) return fallback;
  const [terbanyak] = [...hitung.entries()].sort((a, b) => b[1] - a[1]);
  return Number(terbanyak[0]);
}

async function withOwner(rows) {
  const codes = await fetchCodes();
  const byId = new Map(codes.map(c => [String(c.id), c]));
  const boxIds = [...new Set(rows.map(r => r.box_id).filter(Boolean))];
  const { data: boxes } = boxIds.length
    ? await supabase.from('boxes').select('id, name, status').in('id', boxIds)
    : { data: [] };
  const boxById = new Map((boxes || []).map(b => [String(b.id), b]));

  return rows.map(r => ({
    ...r,
    owner: byId.get(String(r.owner_code_id)) || null,
    box: boxById.get(String(r.box_id)) || null,
  }));
}

// Resi yang ikut dalam permintaan, lengkap dengan keterangan fotonya
async function parcelsOf(ids) {
  const list = (ids || []).map(Number).filter(Boolean);
  if (!list.length) return [];
  const { data } = await supabase
    .from('wh_parcels')
    .select('id, tracking_number, recipient_name, type, photo_url, box_id')
    .in('id', list);
  return data || [];
}

// ── Daftar permintaan (admin) ───────────────────────────────────────
//  ?status=pending|approved|rejected|all   (bawaan: pending)
router.get('/', async (req, res) => {
  const status = String(req.query.status || 'pending');
  let q = supabase.from('box_close_requests').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return res.json({ requests: [], ready: false, error: BELUM_AKTIF });

  const rows = await withOwner(data || []);
  const semuaId = [...new Set(rows.flatMap(r => r.parcel_ids || []))];
  const parcels = await parcelsOf(semuaId);
  const byId = new Map(parcels.map(p => [String(p.id), p]));

  // Box yang ditampilkan ikut resinya sekarang; kalau sudah bergeser,
  // nama box lamanya tetap disebut supaya admin tidak bingung.
  const boxLain = [...new Set(rows.map(r => {
    const isi = (r.parcel_ids || []).map(id => byId.get(String(id))).filter(Boolean);
    return boxSekarang(isi, r.box_id);
  }).filter(Boolean))];
  const { data: boxes2 } = boxLain.length
    ? await supabase.from('boxes').select('id, name, status').in('id', boxLain)
    : { data: [] };
  const box2ById = new Map((boxes2 || []).map(b => [String(b.id), b]));

  res.json({
    ready: true,
    requests: rows.map(r => {
      const isi = (r.parcel_ids || []).map(id => byId.get(String(id))).filter(Boolean);
      const kini = boxSekarang(isi, r.box_id);
      const pindah = String(kini) !== String(r.box_id);
      return {
        ...r,
        parcels: isi,
        box: box2ById.get(String(kini)) || r.box,
        box_lama: pindah ? r.box : null,
        box_id_kini: kini,
      };
    }),
  });
});

// Lencana di menu admin
router.get('/count', async (req, res) => {
  const { count, error } = await supabase
    .from('box_close_requests').select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  res.json({ count: error ? 0 : count || 0 });
});

// ── Milik pelanggan sendiri ─────────────────────────────────────────
router.get('/mine', async (req, res) => {
  const me = await viewerOf(req);
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  const { data, error } = await supabase
    .from('box_close_requests').select('*')
    .eq('owner_code_id', me.id)
    .order('created_at', { ascending: false }).limit(20);
  if (error) return res.json({ requests: [], ready: false });

  res.json({ ready: true, requests: data || [] });
});

// ── Pelanggan mengajukan ────────────────────────────────────────────
router.post('/', async (req, res) => {
  const me = await viewerOf(req);
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  const ids = [...new Set((Array.isArray(req.body.parcel_ids) ? req.body.parcel_ids : []).map(Number).filter(Boolean))];
  const address = String(req.body.address || '').trim();

  if (!ids.length)  return res.status(400).json({ error: 'Pilih dulu resi yang mau dikirim' });
  if (!address)     return res.status(400).json({ error: 'Alamat pengiriman wajib diisi' });

  // Resi harus miliknya sendiri dan fotonya sudah ada — dua-duanya dicek
  // di server, jadi tidak bisa dilewati dari layar pelanggan.
  const dipilih = await parcelsOf(ids);
  const { data: milikku } = await supabase
    .from('wh_parcels').select('id').eq('owner_code_id', me.id).in('id', ids);
  const sah = new Set((milikku || []).map(p => String(p.id)));

  const bukanMilikku = dipilih.filter(p => !sah.has(String(p.id)));
  if (bukanMilikku.length || dipilih.length !== ids.length) {
    return res.status(403).json({ error: 'Ada resi yang bukan milikmu' });
  }

  const tanpaFoto = dipilih.filter(p => !p.photo_url);
  if (tanpaFoto.length) {
    return res.status(400).json({
      error: `${tanpaFoto.length} resi belum ada foto arrival — tunggu fotonya diupload admin dulu ya`,
      without_photo: tanpaFoto.map(p => p.tracking_number),
    });
  }

  // Satu permintaan yang masih menunggu sudah cukup
  const { data: nunggu } = await supabase
    .from('box_close_requests').select('id')
    .eq('owner_code_id', me.id).eq('status', 'pending').maybeSingle();
  if (nunggu) {
    return res.status(409).json({ error: 'Permintaan tutup box kamu yang sebelumnya masih ditinjau admin' });
  }

  const asuransi = req.body.insurance === true || req.body.insurance === 'true';
  const payload = {
    owner_code_id: me.id,
    box_id: dipilih[0]?.box_id || null,
    parcel_ids: ids,
    parcel_count: ids.length,
    recipient_name: String(req.body.recipient_name || '').trim() || me.label,
    phone: String(req.body.phone || '').trim() || null,
    address,
    courier: String(req.body.courier || 'general').toLowerCase() === 'sf' ? 'sf' : 'general',
    sf_ok: req.body.sf_ok === true || req.body.sf_ok === 'true',
    insurance: asuransi,
    insurance_cny: asuransi ? Math.max(0, num(req.body.insurance_cny)) : 0,
    note: String(req.body.note || '').trim() || null,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('box_close_requests').insert(payload).select().single();
  if (error) return res.status(503).json({ error: BELUM_AKTIF });

  logActivity({
    action: 'box_close_request',
    summary: `${me.label} minta tutup box · ${ids.length} resi`,
    detail: `Ekspedisi ${payload.courier === 'sf' ? 'SF' : 'general'}`
      + (payload.insurance ? ` · asuransi ¥${payload.insurance_cny}` : ' · tanpa asuransi'),
    ref_type: 'box_close_request',
    ref_id: data.id,
  });

  res.json(data);
});

// ── Checklist packing ───────────────────────────────────────────────
//
//  Daftarnya persis isi permintaan ini, bukan seluruh box: yang dicentang
//  berarti barangnya sudah masuk kardus. Kalau ada yang ternyata tidak
//  ketemu, resinya dikeluarkan dari permintaan — jadi yang ditagih nanti
//  cocok dengan yang benar-benar dikirim.
const PACK_BELUM_AKTIF =
  'Checklist packing belum aktif — jalankan supabase/migrations/022_packing_checklist.sql';

router.get('/:id/packlist', async (req, res) => {
  const { data: minta, error } = await supabase
    .from('box_close_requests').select('*').eq('id', req.params.id).single();
  if (error || !minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });

  const siap = await hasColumn('wh_parcels', 'packed_at');
  const ids = (minta.parcel_ids || []).map(Number).filter(Boolean);
  const kolom = 'id, tracking_number, recipient_name, type, photo_url, estimated_quantity, box_id'
    + (siap ? ', packed_at' : '');
  const { data: rows } = ids.length
    ? await supabase.from('wh_parcels').select(kolom).in('id', ids)
    : { data: [] };

  // Urutannya mengikuti urutan di permintaan
  const byId = new Map((rows || []).map(p => [String(p.id), p]));
  const parcels = ids.map(i => byId.get(String(i))).filter(Boolean)
    .map(p => ({ ...p, packed_at: siap ? p.packed_at : null }));

  const withBox = (await withOwner([minta]))[0];
  res.json({
    ready: siap,
    error: siap ? null : PACK_BELUM_AKTIF,
    request: { id: minta.id, status: minta.status, owner: withBox.owner, box: withBox.box },
    parcels,
    packed: parcels.filter(p => p.packed_at).length,
    total: parcels.length,
  });
});

//  body { ids: [...], packed: true|false }
router.post('/:id/pack', async (req, res) => {
  if (!(await hasColumn('wh_parcels', 'packed_at'))) {
    return res.status(503).json({ error: PACK_BELUM_AKTIF });
  }
  const { data: minta } = await supabase
    .from('box_close_requests').select('parcel_ids').eq('id', req.params.id).single();
  if (!minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });

  const milik = new Set((minta.parcel_ids || []).map(String));
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : [])
    .map(Number).filter(x => x && milik.has(String(x)));   // hanya resi di permintaan ini
  if (!ids.length) return res.status(400).json({ error: 'Tidak ada resi yang dipilih' });

  const masuk = req.body.packed !== false;
  const { error } = await supabase
    .from('wh_parcels')
    .update({ packed_at: masuk ? new Date().toISOString() : null })
    .in('id', ids);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, updated: ids.length, packed: masuk });
});

//  body { ids: [...] } — barangnya tidak ketemu, keluarkan dari permintaan
router.post('/:id/drop', async (req, res) => {
  const { data: minta, error: cariErr } = await supabase
    .from('box_close_requests').select('*').eq('id', req.params.id).single();
  if (cariErr || !minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });

  const buang = new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String));
  if (!buang.size) return res.status(400).json({ error: 'Tidak ada resi yang dipilih' });

  const sisa = (minta.parcel_ids || []).filter(i => !buang.has(String(i)));
  const { data, error } = await supabase
    .from('box_close_requests')
    .update({ parcel_ids: sisa, parcel_count: sisa.length })
    .eq('id', minta.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Resinya tetap di boxnya, cuma tidak ikut kiriman ini — tanda packingnya
  // dilepas supaya tidak terbawa kalau nanti diikutkan lagi.
  if (await hasColumn('wh_parcels', 'packed_at')) {
    await supabase.from('wh_parcels')
      .update({ packed_at: null }).in('id', [...buang].map(Number).filter(Boolean));
  }

  const { data: resi } = await supabase
    .from('wh_parcels').select('tracking_number').in('id', [...buang].map(Number).filter(Boolean));
  logActivity({
    action: 'box_close_drop',
    summary: `${buang.size} resi dikeluarkan dari permintaan tutup box (barangnya tidak ada)`,
    detail: (resi || []).map(x => x.tracking_number).join(' · '),
    ref_type: 'box_close_request',
    ref_id: minta.id,
  });

  res.json(data);
});

// ── Admin menyetujui ────────────────────────────────────────────────
//  Box yang berisi resi itu ditutup, dan box berikutnya langsung dibuat
//  supaya resi baru pelanggan punya tempat.
router.patch('/:id/approve', async (req, res) => {
  const { data: minta, error: cariErr } = await supabase
    .from('box_close_requests').select('*').eq('id', req.params.id).single();
  if (cariErr || !minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
  if (minta.status !== 'pending') return res.status(409).json({ error: 'Permintaan ini sudah diputuskan' });

  const dipilih = await parcelsOf(minta.parcel_ids);
  const tanpaFoto = dipilih.filter(p => !p.photo_url);
  if (tanpaFoto.length) {
    return res.status(400).json({
      error: `Masih ada ${tanpaFoto.length} resi tanpa foto arrival — upload dulu sebelum box ditutup`,
      without_photo: tanpaFoto.map(p => p.tracking_number),
    });
  }

  // Resi yang tidak ikut dipilih tidak boleh ikut tertutup: dipindahkan
  // lebih dulu ke box berikutnya. Boxnya diambil dari tempat resinya
  // sekarang — resi bisa bergeser ke box berikutnya setelah permintaan
  // diajukan, mis. gara-gara invoice sebagian ditandai lunas.
  const boxId = boxSekarang(dipilih, minta.box_id);
  let pindah = 0;
  if (boxId) {
    const ikut = new Set((minta.parcel_ids || []).map(String));
    const { data: isiBox } = await supabase
      .from('wh_parcels').select('id').eq('box_id', boxId);
    const sisa = (isiBox || []).filter(p => !ikut.has(String(p.id))).map(p => p.id);

    if (sisa.length) {
      await supabase.from('wh_parcels').update({ box_id: null }).in('id', sisa);
      pindah = sisa.length;
    }
    await closeBox(boxId);
    // Box berikutnya dibuat sekaligus mengambil resi yang barusan dilepas
    await ensureOpenBox(minta.owner_code_id);
  }

  const { data, error } = await supabase
    .from('box_close_requests')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      admin_note: String(req.body.admin_note || '').trim() || null,
      box_id: boxId,          // box yang benar-benar ditutup
    })
    .eq('id', minta.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const codes = await fetchCodes();
  const label = codes.find(c => String(c.id) === String(minta.owner_code_id))?.label || 'pelanggan';
  const geser = String(boxId) !== String(minta.box_id) ? ' · box sudah bergeser sejak diajukan' : '';
  logActivity({
    action: 'box_close_approved',
    summary: `Permintaan tutup box ${label} disetujui · ${minta.parcel_count} resi`,
    detail: (pindah ? `${pindah} resi yang tidak ikut dipindah ke box berikutnya` : 'semua resinya ikut')
      + geser,
    ref_type: 'box_close_request',
    ref_id: minta.id,
  });

  res.json({ ...data, moved: pindah });
});

// ── Batalkan persetujuan ────────────────────────────────────────────
//  Boxnya dibuka lagi, resi yang terlanjur terarsip dihidupkan, dan resi
//  yang tadi dipindah ke box berikutnya ditarik kembali. Permintaannya
//  balik ke daftar menunggu, jadi bisa disetujui ulang setelah urusan
//  invoicenya beres. Resi yang baru masuk sesudah persetujuan dibiarkan di
//  box barunya — itu memang punya kiriman berikutnya.
router.patch('/:id/reopen', async (req, res) => {
  const { data: minta, error: cariErr } = await supabase
    .from('box_close_requests').select('*').eq('id', req.params.id).single();
  if (cariErr || !minta) return res.status(404).json({ error: 'Permintaan tidak ditemukan' });
  if (minta.status !== 'approved') {
    return res.status(409).json({ error: 'Yang bisa dibatalkan hanya permintaan yang sudah disetujui' });
  }

  const boxId = minta.box_id;
  let ditarik = 0;
  let dihapus = 0;

  if (boxId) {
    const { data: box } = await supabase
      .from('boxes').select('id, owner_code_id').eq('id', boxId).single();

    // Box berikutnya yang lahir gara-gara persetujuan tadi. Dicari sejak
    // permintaannya masuk, bukan sejak disetujui — box penggantinya dibuat
    // beberapa detik sebelum stempel persetujuan ditulis.
    const batas = minta.decided_at || minta.created_at;
    const { data: boxBaru } = await supabase
      .from('boxes').select('id')
      .eq('owner_code_id', box?.owner_code_id)
      .eq('status', 'open')
      .gte('created_at', minta.created_at);

    for (const b of boxBaru || []) {
      if (String(b.id) === String(boxId)) continue;
      const { data: isi } = await supabase
        .from('wh_parcels').select('id, created_at').eq('box_id', b.id);

      // Hanya resi yang sudah ada sebelum persetujuan yang ditarik pulang
      const pindahan = (isi || []).filter(x => new Date(x.created_at) < new Date(batas));
      if (pindahan.length) {
        await supabase.from('wh_parcels')
          .update({ box_id: boxId }).in('id', pindahan.map(x => x.id));
        ditarik += pindahan.length;
      }
      // Box itu dibuang kalau jadi kosong — tidak menyisakan box hampa
      if (pindahan.length === (isi || []).length) {
        await supabase.from('boxes').delete().eq('id', b.id);
        dihapus++;
      }
    }

    await supabase.from('boxes')
      .update({ status: 'open', closed_at: null }).eq('id', boxId);
    await supabase.from('wh_parcels')
      .update({ status: 'active' }).eq('box_id', boxId).eq('status', 'archived');
  }

  const { data, error } = await supabase
    .from('box_close_requests')
    .update({ status: 'pending', decided_at: null, admin_note: null })
    .eq('id', minta.id).select().single();
  if (error) return res.status(500).json({ error: error.message });

  logActivity({
    action: 'box_close_reopened',
    summary: `Persetujuan tutup box dibatalkan · ${minta.parcel_count} resi`,
    detail: `Box dibuka lagi${ditarik ? `, ${ditarik} resi ditarik kembali` : ''}${dihapus ? `, ${dihapus} box kosong dihapus` : ''}`,
    ref_type: 'box_close_request',
    ref_id: minta.id,
  });

  res.json({ ...data, pulled: ditarik, removed_boxes: dihapus });
});

// ── Admin menolak ───────────────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const { data, error } = await supabase
    .from('box_close_requests')
    .update({
      status: 'rejected',
      decided_at: new Date().toISOString(),
      admin_note: String(req.body.admin_note || '').trim() || null,
    })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(503).json({ error: BELUM_AKTIF });

  logActivity({
    action: 'box_close_rejected',
    summary: `Permintaan tutup box ditolak`,
    detail: data.admin_note,
    ref_type: 'box_close_request',
    ref_id: data.id,
  });

  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('box_close_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
