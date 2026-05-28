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

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ success: true, token: 'djematcha-admin-token' });
  } else {
    res.status(401).json({ error: 'Username atau password salah' });
  }
});

// Routes
app.use('/api/codes', require('./routes/codes'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/parcels', require('./routes/parcels'));

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
