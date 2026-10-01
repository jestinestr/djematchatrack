const express = require('express');
const router = express.Router();
const { getSettings, setSetting, DEFAULTS } = require('../lib/settings');
const { logActivity } = require('../lib/log');

// Setelan yang bisa diubah admin dari panel. `_ready: false` berarti tabel
// setelannya belum dibuat, jadi panel bisa memberi tahu alasannya.
router.get('/', async (req, res) => {
  res.json(await getSettings());
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
    res.json({ key, value });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

module.exports = router;
