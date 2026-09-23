// Load .env for local development
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const app = express();

// CORS: allow localhost in dev, and Vercel domain in prod
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // set this in Vercel env vars once you know the domain
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin in prod)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Admin auth — dari environment variable, fallback ke default
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'djematcha2024';

// Akun khusus upload foto (panel ponsel). Hanya bisa membuka /foto:
// cari resi, unggah foto, dan mengubah data dasar. Tidak melihat biaya,
// denda, invoice, atau kode akses.
//
// Password asli HANYA di environment variable (.env lokal / Vercel), tidak
// pernah ditulis di file ini — repo ini publik. Tanpa PHOTO_PASSWORD akun
// foto dimatikan, jadi tidak ada password bawaan yang bisa ditebak orang.
const PHOTO_USER = process.env.PHOTO_USERNAME || 'Vey';
const PHOTO_PASS = process.env.PHOTO_PASSWORD || '';

// Keyboard ponsel gemar menambah huruf besar dan spasi di ujung, jadi
// username tidak peka huruf besar/kecil dan spasi tepi dibuang dari keduanya.
const sameUser = (a, b) => String(a || '').trim().toLowerCase() === String(b).trim().toLowerCase();
const samePass = (a, b) => String(a || '').trim() === String(b).trim();

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (sameUser(username, ADMIN_USER) && samePass(password, ADMIN_PASS)) {
    return res.json({ success: true, role: 'admin', token: 'djematcha-admin-token' });
  }
  if (PHOTO_PASS && sameUser(username, PHOTO_USER) && samePass(password, PHOTO_PASS)) {
    return res.json({ success: true, role: 'photo', token: 'djematcha-photo-token' });
  }
  res.status(401).json({ error: 'Username atau password salah' });
});

// Routes
app.use('/api/codes', require('./routes/codes'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/parcels', require('./routes/parcels'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/boxes', require('./routes/boxes').router);
app.use('/api/photos', require('./routes/photos'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' }));

// Export for Vercel serverless
module.exports = app;

// Start server when run directly (local dev)
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🍵 Djematcha backend berjalan di http://localhost:${PORT}`);
  });
}
