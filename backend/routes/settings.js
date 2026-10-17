const express = require('express');
const router = express.Router();
const { getSettings, setSetting, DEFAULTS } = require('../lib/settings');
const { logActivity } = require('../lib/log');

// Setelan yang bisa diubah admin dari panel. `_ready: false` berarti tabel
// setelannya belum dibuat, jadi panel bisa memberi tahu alasannya.
router.get('/', async (req, res) => {
  res.json(await getSettings());
});

// Yang boleh dibaca pelanggan tanpa login admin: pengumuman dan tarif
// dendanya, supaya panel pelanggan bisa menampilkan infonya sendiri.
router.get('/public', async (req, res) => {
  const all = await getSettings();
  res.json({
    manual_fine_on: !!all.manual_fine_on,
    manual_fine_amount: Number(all.manual_fine_amount) || 0,
    manual_fine_notice: all.manual_fine_notice || '',
  });
});

router.put('/:key', async (req, res) => {
  const { key } = req.params;
  if (!(key in DEFAULTS)) return res.status(400).json({ error: 'Setelan tidak dikenal' });

  try {
    const value = await setSetting(key, req.body.value);
    if (key === 'auto_approve_requests') {
      logActivity({
        action: 'setting',
        summary: `Mode auto ACC setor resi ${value ? 'dinyalakan' : 'dimatikan'}`,
      });
    }
    if (key === 'manual_fine_on') {
      logActivity({
        action: 'setting',
        summary: `Denda resi ketikan admin ${value ? 'dinyalakan' : 'dimatikan'}`,
      });
    }
    if (key === 'manual_fine_amount') {
      logActivity({
        action: 'setting',
        summary: `Tarif denda resi ketikan admin jadi Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}/resi`,
      });
    }
    res.json({ key, value });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

module.exports = router;
