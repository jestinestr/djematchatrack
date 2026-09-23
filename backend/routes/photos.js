const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { fetchCodes, norm } = require('../lib/owner');

const TABLE = { hc: 'hc_parcels', wh: 'wh_parcels' };

// ── Tandai foto sudah diunduh ───────────────────────────────────────
//  body: { kind: 'hc'|'wh', ids: [...] }
//  Admin  : POST /api/photos/downloaded
//  Pelanggan: POST /api/photos/downloaded/mine (header X-Access-Code),
//             hanya boleh menandai resi miliknya sendiri.
async function mark(table, ids, column) {
  const { error } = await supabase
    .from(table)
    .update({ [column]: new Date().toISOString() })
    .in('id', ids);
  return error;
}

router.post('/downloaded', async (req, res) => {
  const { kind, ids } = req.body;
  const table = TABLE[String(kind).toLowerCase()];
  if (!table || !Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }
  const error = await mark(table, ids, 'photo_dl_admin');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.post('/downloaded/mine', async (req, res) => {
  const { kind, ids } = req.body;
  const table = TABLE[String(kind).toLowerCase()];
  if (!table || !Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  const rawCode = (req.get('X-Access-Code') || '').trim();
  const codes = await fetchCodes();
  const me = codes.find(c => norm(c.code) === norm(rawCode));
  if (!me) return res.status(401).json({ error: 'Kode akses tidak valid' });

  // Hanya resi milik pelanggan ini yang boleh ditandai
  const { data: mine } = await supabase
    .from(table).select('id').in('id', ids).eq('owner_code_id', me.id);
  const allowed = (mine || []).map(r => r.id);
  if (!allowed.length) return res.json({ success: true, marked: 0 });

  const error = await mark(table, allowed, 'photo_dl_user');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, marked: allowed.length });
});

module.exports = router;
