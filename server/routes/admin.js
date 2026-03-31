const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { getDb } = require('../services/db')
const { encrypt, decrypt } = require('../services/crypto')
const { requireAuth, requireAdmin } = require('../middleware/auth')

router.use(requireAuth)
router.use(requireAdmin)

// GET /api/admin/codes - List all login codes
router.get('/codes', (req, res) => {
  const db = getDb()
  const codes = db.prepare('SELECT id, code, label, mac, is_admin, enabled, created_at, bound_at, last_login FROM codes ORDER BY created_at DESC').all()
  res.json({ codes })
})

// POST /api/admin/codes - Generate new login codes
router.post('/codes', (req, res) => {
  const { label = '', count = 1, is_admin = false } = req.body
  const db = getDb()
  const now = new Date().toISOString()
  const created = []

  const stmt = db.prepare('INSERT INTO codes (code, label, is_admin, enabled, created_at) VALUES (?, ?, ?, 1, ?)')

  for (let i = 0; i < Math.min(count, 50); i++) {
    const code = crypto.randomBytes(4).toString('hex') // 8-char hex
    try {
      stmt.run(code, label, is_admin ? 1 : 0, now)
      created.push({ code, label })
    } catch (e) {
      console.error('Failed to create code:', e.message)
    }
  }

  res.json({ created })
})

// PUT /api/admin/codes/:id - Update code (unbind, toggle enabled, change label)
router.put('/codes/:id', (req, res) => {
  const { id } = req.params
  const { enabled, label, unbind } = req.body
  const db = getDb()

  const existing = db.prepare('SELECT * FROM codes WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ error: 'Code not found' })
  }

  if (unbind) {
    db.prepare('UPDATE codes SET mac = NULL, bound_at = NULL WHERE id = ?').run(id)
  }
  if (typeof enabled === 'number' || typeof enabled === 'boolean') {
    db.prepare('UPDATE codes SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  }
  if (typeof label === 'string') {
    db.prepare('UPDATE codes SET label = ? WHERE id = ?').run(label, id)
  }

  const updated = db.prepare('SELECT id, code, label, mac, is_admin, enabled, created_at, bound_at, last_login FROM codes WHERE id = ?').get(id)
  res.json({ code: updated })
})

// DELETE /api/admin/codes/:id - Delete a code
router.delete('/codes/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const result = db.prepare('DELETE FROM codes WHERE id = ?').run(id)
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Code not found' })
  }
  res.json({ success: true })
})

// GET /api/admin/config - Get config (keys are masked)
router.get('/config', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM config').all()
  const config = {}
  for (const row of rows) {
    try {
      const val = decrypt(row.value)
      config[row.key] = val.length > 8
        ? val.slice(0, 4) + '****' + val.slice(-4)
        : '****'
    } catch {
      config[row.key] = '****'
    }
  }
  res.json({ config })
})

// PUT /api/admin/config - Set config values
router.put('/config', (req, res) => {
  const { minimax_api_key, gemini_api_key } = req.body
  const db = getDb()

  const upsert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')

  if (minimax_api_key) {
    upsert.run('minimax_api_key', encrypt(minimax_api_key))
  }
  if (gemini_api_key) {
    upsert.run('gemini_api_key', encrypt(gemini_api_key))
  }

  res.json({ success: true })
})

module.exports = router
