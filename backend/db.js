// Uses Node.js built-in sqlite (available since Node 22.5, unflagged in Node 22.11+/24+)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'djematcha.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('HC', 'WH')),
      batch_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS hc_parcels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      tracking_number TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      photo_url TEXT,
      type TEXT NOT NULL CHECK(type IN ('paperbased', 'barang')),
      estimated_weight_grams INTEGER NOT NULL DEFAULT 0,
      estimated_quantity INTEGER NOT NULL DEFAULT 1,
      is_manual_input INTEGER NOT NULL DEFAULT 0,
      fine_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wh_parcels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id),
      tracking_number TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      photo_url TEXT,
      type TEXT NOT NULL CHECK(type IN ('paperbased', 'barang')),
      wh_fee INTEGER NOT NULL DEFAULT 0,
      is_manual_input INTEGER NOT NULL DEFAULT 0,
      fine_amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS access_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed initial active batches if none exist
  const hcBatch = db.prepare("SELECT id FROM batches WHERE type='HC' AND status='active'").get();
  if (!hcBatch) {
    db.prepare("INSERT INTO batches (type, batch_number, status) VALUES ('HC', 1, 'active')").run();
  }

  const whBatch = db.prepare("SELECT id FROM batches WHERE type='WH' AND status='active'").get();
  if (!whBatch) {
    db.prepare("INSERT INTO batches (type, batch_number, status) VALUES ('WH', 1, 'active')").run();
  }

  // Seed default access code if none exist
  const codeCount = db.prepare("SELECT COUNT(*) as cnt FROM access_codes").get();
  if (codeCount.cnt === 0) {
    db.prepare("INSERT INTO access_codes (code, label) VALUES ('djematcha123', 'Kode Default')").run();
  }
}

init();

// Helper: run statements in a transaction
db.transaction = function(fn) {
  return function(...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
};

module.exports = db;
