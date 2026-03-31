const express = require('express')
const router = express.Router()
const { getDb } = require('../services/db')
const { decrypt } = require('../services/crypto')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

function getConfigValue(key) {
  const db = getDb()
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key)
  if (!row) return null
  try {
    return decrypt(row.value)
  } catch (e) {
    console.error(`Failed to decrypt config key "${key}":`, e.message)
    return null
  }
}

// POST /api/proxy/minimax
router.post('/minimax', async (req, res) => {
  const apiKey = getConfigValue('minimax_api_key')
  if (!apiKey) {
    return res.status(500).json({ error: 'MiniMax API Key not configured. Ask admin to set it.' })
  }

  try {
    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.json(data)
  } catch (e) {
    console.error('MiniMax proxy error:', e.message)
    res.status(502).json({ error: 'Failed to reach MiniMax API' })
  }
})

// POST /api/proxy/gemini
router.post('/gemini', async (req, res) => {
  const apiKey = getConfigValue('gemini_api_key')
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key not configured. Ask admin to set it.' })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.json(data)
  } catch (e) {
    console.error('Gemini proxy error:', e.message)
    res.status(502).json({ error: 'Failed to reach Gemini API' })
  }
})

module.exports = router
