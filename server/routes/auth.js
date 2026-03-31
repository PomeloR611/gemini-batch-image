const express = require('express')
const router = express.Router()
const { getDb } = require('../services/db')
const { getMacFromIp } = require('../services/arp')

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { code } = req.body
  if (!code) {
    return res.status(400).json({ error: 'Login code required' })
  }

  const db = getDb()
  const row = db.prepare('SELECT * FROM codes WHERE code = ?').get(code)

  if (!row) {
    return res.status(401).json({ error: 'Invalid login code' })
  }

  if (!row.enabled) {
    return res.status(403).json({ error: 'This code has been disabled' })
  }

  const clientIp = req.ip || req.connection.remoteAddress
  const mac = getMacFromIp(clientIp)

  if (!mac && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== '::ffff:127.0.0.1') {
    return res.status(500).json({ error: 'Cannot determine device MAC address. Make sure the server uses --network=host.' })
  }

  const now = new Date().toISOString()

  if (row.mac === null) {
    // First login: bind MAC
    db.prepare('UPDATE codes SET mac = ?, bound_at = ?, last_login = ? WHERE id = ?')
      .run(mac, now, now, row.id)
  } else if (row.mac !== mac) {
    // MAC mismatch
    return res.status(403).json({ error: 'This code is already bound to another device' })
  } else {
    // MAC matches, update last login
    db.prepare('UPDATE codes SET last_login = ? WHERE id = ?').run(now, row.id)
  }

  req.session.user = {
    id: row.id,
    code: row.code,
    label: row.label,
    is_admin: row.is_admin === 1,
    mac: mac || row.mac
  }

  res.json({
    success: true,
    user: {
      label: row.label,
      is_admin: row.is_admin === 1
    }
  })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: req.session.user })
})

module.exports = router
