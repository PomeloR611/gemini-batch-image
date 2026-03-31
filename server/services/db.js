const path = require('path')
const Database = require('better-sqlite3')
const { encrypt } = require('./crypto')

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'app.db')

let db = null

function getDb() {
  if (db) return db

  const fs = require('fs')
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT DEFAULT '',
      mac TEXT DEFAULT NULL,
      is_admin INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      bound_at TEXT DEFAULT NULL,
      last_login TEXT DEFAULT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired TEXT NOT NULL
    )
  `)

  // First-run: create admin code from env var
  const adminCode = process.env.ADMIN_CODE
  if (adminCode) {
    const existing = db.prepare('SELECT id FROM codes LIMIT 1').get()
    if (!existing) {
      db.prepare(
        'INSERT INTO codes (code, label, is_admin, enabled, created_at) VALUES (?, ?, 1, 1, ?)'
      ).run(adminCode, 'Initial Admin', new Date().toISOString())
      console.log(`Admin code created: ${adminCode}`)
    }
  }

  return db
}

module.exports = { getDb, DATA_DIR }
