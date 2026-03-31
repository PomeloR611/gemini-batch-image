# Containerized Auth & Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Gemini Batch Image from a pure frontend app to a Docker-deployed server-backed app with login code auth, MAC binding, and API proxy.

**Architecture:** Single Express server serves the React frontend build as static files. All external API calls (MiniMax, Gemini) are proxied through the server which injects API Keys. Authentication uses login codes bound to MAC addresses via ARP lookup. SQLite stores all persistent data.

**Tech Stack:** Node.js 20, Express, better-sqlite3, express-session, crypto (built-in), React 18, Vite 5, Tailwind CSS 3.4, Docker

---

## File Structure

### New files (server)

```
server/
  package.json           -- Server dependencies (express, better-sqlite3, express-session, etc.)
  index.js               -- Express app: static files, session, route mounting, DB init
  middleware/auth.js      -- requireAuth, requireAdmin middleware functions
  routes/auth.js         -- POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
  routes/proxy.js        -- POST /api/proxy/minimax, POST /api/proxy/gemini
  routes/admin.js        -- CRUD login codes, config management, user list
  services/db.js         -- SQLite init, table creation, query helpers
  services/arp.js        -- ARP table parsing, MAC lookup by IP
  services/crypto.js     -- AES-256-CBC encrypt/decrypt for API Key storage
```

### New files (frontend)

```
src/components/LoginPage.jsx       -- Login code input page
src/components/AdminPanel/index.jsx -- Admin panel: codes, users, config
src/services/auth.js               -- Frontend auth API calls (login, logout, me)
```

### Modified files (frontend)

```
src/App.jsx                        -- Add login gate, admin tab routing
src/context/AppContext.jsx          -- Add user state, remove apiKey states
src/components/Header.jsx          -- Add admin tab, logout button
src/components/Settings/index.jsx  -- Remove API Key fields for non-admin
src/components/BatchGenerate/index.jsx -- Use proxy, remove key dependencies
src/services/gemini.js             -- Request /api/proxy/gemini instead of direct API
src/services/minimax.js            -- Request /api/proxy/minimax instead of direct API
src/services/storage.js            -- Remove File System Access, use browser download only
src/i18n/zh.json                   -- Add auth/admin translation keys
src/i18n/en.json                   -- Add auth/admin translation keys
```

### New files (deployment)

```
Dockerfile                         -- Multi-stage build
.dockerignore                      -- Exclude node_modules, data, etc.
```

---

### Task 1: Server Scaffolding & SQLite Setup

**Files:**
- Create: `server/package.json`
- Create: `server/services/db.js`
- Create: `server/services/crypto.js`
- Create: `server/index.js`

- [ ] **Step 1: Create server/package.json**

```json
{
  "name": "gemini-batch-server",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.7.0",
    "express-session": "^1.18.1",
    "better-sqlite3-session-store": "^0.1.0",
    "cors": "^2.8.5"
  }
}
```

- [ ] **Step 2: Create server/services/crypto.js**

```javascript
const crypto = require('crypto')

const ALGORITHM = 'aes-256-cbc'

function getKey() {
  const raw = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-prod!!'
  return crypto.createHash('sha256').update(raw).digest()
}

function encrypt(text) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

function decrypt(data) {
  const [ivHex, encrypted] = data.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

module.exports = { encrypt, decrypt }
```

- [ ] **Step 3: Create server/services/db.js**

```javascript
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
```

- [ ] **Step 4: Create server/index.js (minimal, static + session)**

```javascript
const express = require('express')
const path = require('path')
const session = require('express-session')
const { getDb } = require('./services/db')

const app = express()
const PORT = process.env.PORT || 3000

// Init DB
getDb()

// Body parsing
app.use(express.json({ limit: '50mb' }))

// Session with SQLite store
// Using a simple in-memory store for now; we'll use the sessions table manually if needed
app.use(session({
  secret: process.env.ENCRYPTION_KEY || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}))

// API routes (mounted in later tasks)
// app.use('/api/auth', require('./routes/auth'))
// app.use('/api/proxy', require('./routes/proxy'))
// app.use('/api/admin', require('./routes/admin'))

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`)
})
```

- [ ] **Step 5: Install server dependencies and verify startup**

Run:
```bash
cd server && npm install
```
Expected: `node_modules` created, no errors.

Run:
```bash
cd .. && npm run build
```
Expected: `dist/` directory created with built frontend.

Run:
```bash
node server/index.js
```
Expected: `Server running at http://0.0.0.0:3000`, `data/app.db` created. Ctrl+C to stop.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/services/db.js server/services/crypto.js server/index.js
git commit -m "feat: add server scaffolding with Express, SQLite, and session setup"
```

---

### Task 2: ARP Service & Auth Routes

**Files:**
- Create: `server/services/arp.js`
- Create: `server/middleware/auth.js`
- Create: `server/routes/auth.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/services/arp.js**

```javascript
const { execSync } = require('child_process')

function getMacFromIp(clientIp) {
  // Localhost access — no MAC available
  if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    return 'local'
  }

  // Strip IPv6 prefix if present
  const ip = clientIp.replace(/^::ffff:/, '')

  try {
    const output = execSync('arp -a', { encoding: 'utf8', timeout: 5000 })
    const lines = output.split('\n')

    for (const line of lines) {
      // Windows format: "  192.168.1.50          aa-bb-cc-dd-ee-ff     动态"
      // Linux format:   "? (192.168.1.50) at aa:bb:cc:dd:ee:ff [ether] on eth0"
      if (line.includes(ip)) {
        // Windows: match xx-xx-xx-xx-xx-xx
        const winMatch = line.match(/([0-9a-fA-F]{2}-[0-9a-fA-F]{2}-[0-9a-fA-F]{2}-[0-9a-fA-F]{2}-[0-9a-fA-F]{2}-[0-9a-fA-F]{2})/)
        if (winMatch) {
          return winMatch[1].toLowerCase().replace(/-/g, ':')
        }
        // Linux: match xx:xx:xx:xx:xx:xx
        const linuxMatch = line.match(/([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})/)
        if (linuxMatch) {
          return linuxMatch[1].toLowerCase()
        }
      }
    }
  } catch (e) {
    console.error('ARP lookup failed:', e.message)
  }

  return null
}

module.exports = { getMacFromIp }
```

- [ ] **Step 2: Create server/middleware/auth.js**

```javascript
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  next()
}

function requireAdmin(req, res, next) {
  if (!req.session.user?.is_admin) {
    return res.status(403).json({ error: 'Admin required' })
  }
  next()
}

module.exports = { requireAuth, requireAdmin }
```

- [ ] **Step 3: Create server/routes/auth.js**

```javascript
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
```

- [ ] **Step 4: Mount auth routes in server/index.js**

Replace the commented-out route lines in `server/index.js`:

```javascript
// API routes (mounted in later tasks)
// app.use('/api/auth', require('./routes/auth'))
```

With:

```javascript
// API routes
app.use('/api/auth', require('./routes/auth'))
```

- [ ] **Step 5: Verify auth routes work**

Start the server with an admin code:

```bash
ADMIN_CODE=test1234 ENCRYPTION_KEY=mysecret node server/index.js
```

Test login:
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"code\":\"test1234\"}" -c cookies.txt
```
Expected: `{"success":true,"user":{"label":"Initial Admin","is_admin":true}}`

Test /me:
```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```
Expected: `{"user":{"id":1,"code":"test1234","label":"Initial Admin","is_admin":true,"mac":"local"}}`

- [ ] **Step 6: Commit**

```bash
git add server/services/arp.js server/middleware/auth.js server/routes/auth.js server/index.js
git commit -m "feat: add auth routes with login code verification and MAC binding"
```

---

### Task 3: API Proxy Routes

**Files:**
- Create: `server/routes/proxy.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/routes/proxy.js**

```javascript
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
```

- [ ] **Step 2: Mount proxy routes in server/index.js**

Add after the auth route mounting line:

```javascript
app.use('/api/proxy', require('./routes/proxy'))
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/proxy.js server/index.js
git commit -m "feat: add API proxy routes for MiniMax and Gemini"
```

---

### Task 4: Admin Routes

**Files:**
- Create: `server/routes/admin.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/routes/admin.js**

```javascript
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
      // Mask: show first 4 and last 4 chars
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
```

- [ ] **Step 2: Mount admin routes in server/index.js**

Add after the proxy route mounting line:

```javascript
app.use('/api/admin', require('./routes/admin'))
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/admin.js server/index.js
git commit -m "feat: add admin routes for code management and API Key config"
```

---

### Task 5: Frontend Auth Service & Login Page

**Files:**
- Create: `src/services/auth.js`
- Create: `src/components/LoginPage.jsx`

- [ ] **Step 1: Create src/services/auth.js**

```javascript
export async function login(code) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data
}

export async function logout() {
  const res = await fetch('/api/auth/logout', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Logout failed')
  return data
}

export async function getMe() {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  const data = await res.json()
  return data.user
}
```

- [ ] **Step 2: Create src/components/LoginPage.jsx**

```jsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { login } from '../services/auth'

export default function LoginPage({ onLogin }) {
  const { t } = useApp()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const result = await login(code.trim())
      onLogin(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">
          {t('app.title')}
        </h1>
        <p className="text-gray-500 text-center mb-8">{t('auth.loginHint')}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('auth.codePlaceholder')}
            className="w-full px-4 py-3 border rounded-lg text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            autoFocus
          />

          {error && (
            <p className="text-red-500 text-sm text-center mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              loading || !code.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/auth.js src/components/LoginPage.jsx
git commit -m "feat: add frontend auth service and login page"
```

---

### Task 6: Update AppContext — Add User State, Remove API Key State

**Files:**
- Modify: `src/context/AppContext.jsx`

- [ ] **Step 1: Rewrite src/context/AppContext.jsx**

Replace the entire file content with:

```jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { t as translate } from '../i18n'
import { getMe } from '../services/auth'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh')
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'CNY')
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('history')
    return saved ? JSON.parse(saved) : []
  })
  const [activeTab, setActiveTab] = useState('generate')

  // Auth state
  const [user, setUser] = useState(null) // { id, code, label, is_admin, mac }
  const [authLoading, setAuthLoading] = useState(true)

  // Check session on mount
  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('currency', currency)
  }, [currency])

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history))
  }, [history])

  const value = {
    lang, setLang,
    currency, setCurrency,
    history, setHistory,
    activeTab, setActiveTab,
    user, setUser,
    authLoading,
    t: (key) => translate(key, lang)
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
```

Key changes:
- Removed `minimaxKey`, `setMinimaxKey`, `geminiKey`, `setGeminiKey`, `savePath`, `setSavePath`, `dirHandle` and all their localStorage effects
- Added `user`, `setUser`, `authLoading` state
- Added `getMe()` check on mount

- [ ] **Step 2: Commit**

```bash
git add src/context/AppContext.jsx
git commit -m "refactor: update AppContext to use server auth, remove client-side API key state"
```

---

### Task 7: Update App.jsx — Login Gate & Admin Tab

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Rewrite src/App.jsx**

```jsx
import { AppProvider, useApp } from './context/AppContext'
import BatchGenerate from './components/BatchGenerate'
import History from './components/History'
import Settings from './components/Settings'
import AdminPanel from './components/AdminPanel'
import Header from './components/Header'
import LoginPage from './components/LoginPage'

function AppContent() {
  const { activeTab, user, setUser, authLoading } = useApp()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={(u) => setUser(u)} />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'generate' && <BatchGenerate />}
        {activeTab === 'history' && <History />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'admin' && user.is_admin && <AdminPanel />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add login gate and admin tab routing to App"
```

---

### Task 8: Update Header — Admin Tab & Logout Button

**Files:**
- Modify: `src/components/Header.jsx`

- [ ] **Step 1: Rewrite src/components/Header.jsx**

```jsx
import { useApp } from '../context/AppContext'
import { logout } from '../services/auth'

export default function Header() {
  const { activeTab, setActiveTab, user, setUser, t } = useApp()

  const tabs = [
    { id: 'generate', label: t('app.tabs.generate') },
    { id: 'history', label: t('app.tabs.history') },
    { id: 'settings', label: t('app.tabs.settings') },
  ]

  if (user?.is_admin) {
    tabs.push({ id: 'admin', label: t('app.tabs.admin') })
  }

  const handleLogout = async () => {
    try {
      await logout()
      setUser(null)
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {t('app.title')}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {user?.label || user?.code}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.jsx
git commit -m "feat: add admin tab and logout button to header"
```

---

### Task 9: Rewrite Frontend Services to Use Proxy

**Files:**
- Modify: `src/services/gemini.js`
- Modify: `src/services/minimax.js`
- Modify: `src/services/storage.js`
- Modify: `src/components/BatchGenerate/index.jsx`

- [ ] **Step 1: Rewrite src/services/gemini.js**

```javascript
export async function generateImageWithGemini(prompt) {
  const response = await fetch('/api/proxy/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()

  const parts = data.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      }
    }
  }

  throw new Error('No image in response')
}
```

- [ ] **Step 2: Rewrite src/services/minimax.js**

```javascript
const TRANSLATION_PROMPTS = {
  keyword: `你是一个专业的AI生图Prompt翻译官。请把用户给出的主题词扩展成详细的英文AI生图Prompt。

要求：
1. 每个主题生成1条详细的英文Prompt
2. Prompt需包含：主体描述、环境背景、风格设定、光线氛围、构图角度、画面质量词
3. 回复格式：只输出Prompt本身，不要加引号、编号或解释
4. 语言：Prompt主体用英文，可在括号内保留少量中文备注

用户输入：{input}`,

  reference: `你是一个专业的AI生图Prompt翻译官。请分析用户提供的参考图和描述，生成对应的AI生图Prompt。

要求：
1. 充分理解参考图的风格、氛围、构图
2. 结合用户的描述意图，生成新的Prompt
3. Prompt需包含：主体描述、环境背景、风格设定、光线氛围、构图角度、画面质量词
4. 回复格式：只输出Prompt本身，不要加引号、编号或解释
5. 语言：Prompt主体用英文

参考图描述：{description}`
}

export async function translateWithMinimax(mode, input, imageBase64 = null) {
  const promptTemplate = TRANSLATION_PROMPTS[mode]
  const promptText = promptTemplate.replace('{input}', input).replace('{description}', input)

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: promptText }
  ]

  const body = {
    model: 'MiniMax-M2.7-highspeed',
    messages,
    temperature: 0.8,
    max_tokens: 500
  }

  if (imageBase64) {
    messages[1] = {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
    body.messages = messages
  }

  const response = await fetch('/api/proxy/minimax', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()

  const text = data.choices?.[0]?.message?.content?.trim()
            || data.choices?.[0]?.text?.trim()
            || data.choices?.[0]?.message?.trim()
            || ''

  const usage = data.usage || {}

  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    }
  }
}
```

Key change: removed `key` parameter from both functions, requests go to `/api/proxy/*`.

- [ ] **Step 3: Simplify src/services/storage.js**

Remove File System Access API logic. Server saves via volume mount; frontend only needs browser download fallback:

```javascript
import { base64ToBlob } from '../utils/helpers'

export async function saveImageToFolder(filename, base64, mimeType) {
  // In server mode, images are saved server-side via the proxy.
  // Frontend fallback: browser download.
  const blob = base64ToBlob(base64, mimeType)
  return downloadViaBrowser(blob, filename)
}

export async function downloadViaBrowser(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

export function addToHistory(setHistory, task) {
  setHistory(prev => [task, ...prev])
}

export function clearHistory(setHistory) {
  setHistory([])
}
```

- [ ] **Step 4: Update src/components/BatchGenerate/index.jsx**

This file has many references to `minimaxKey`, `geminiKey`, `dirHandle`. Apply these changes:

In the destructuring from `useApp()` (around line 21-25), change:

```javascript
  const {
    minimaxKey, geminiKey, savePath, dirHandle,
    history, setHistory,
    currency,
    t
  } = useApp()
```

To:

```javascript
  const {
    history, setHistory,
    currency,
    t
  } = useApp()
```

In `handleTranslate` (around line 142-147), remove the minimaxKey check and update the call:

Change:
```javascript
    if (!minimaxKey) {
      alert(t('errors.noMinimaxKey'))
      return
    }
```
To:
```javascript
    // API key check removed — server handles keys
```

In the translate loop (around line 176-181), change:
```javascript
        const result = await translateWithMinimax(
          minimaxKey,
          mode,
          promptInput,
          mode === 'reference' ? referenceImage : null
        )
```
To:
```javascript
        const result = await translateWithMinimax(
          mode,
          promptInput,
          mode === 'reference' ? referenceImage : null
        )
```

In `handleGenerate` (around line 206-209), remove the geminiKey check:

Change:
```javascript
    if (!geminiKey) {
      alert(t('errors.noGeminiKey'))
      return
    }
```
To:
```javascript
    // API key check removed — server handles keys
```

In the generation loop (around line 237), change:
```javascript
            imageData = await generateImageWithGemini(geminiKey, promptToUse)
```
To:
```javascript
            imageData = await generateImageWithGemini(promptToUse)
```

In the save call (around line 264), change:
```javascript
            await saveImageToFolder(dirHandle, filename, imageData.base64, imageData.mimeType)
```
To:
```javascript
            await saveImageToFolder(filename, imageData.base64, imageData.mimeType)
```

In `handleRetry` (around line 336-337), change:
```javascript
    if (!geminiKey || !dirHandle) return
```
To:
```javascript
    // Key/dirHandle checks removed — server handles keys
```

In handleRetry (around line 345), change:
```javascript
      const imageData = await generateImageWithGemini(geminiKey, resultItem.translatedPrompt)
```
To:
```javascript
      const imageData = await generateImageWithGemini(resultItem.translatedPrompt)
```

In handleRetry (around line 348), change:
```javascript
      await saveImageToFolder(dirHandle, filename, imageData.base64, imageData.mimeType)
```
To:
```javascript
      await saveImageToFolder(filename, imageData.base64, imageData.mimeType)
```

- [ ] **Step 5: Commit**

```bash
git add src/services/gemini.js src/services/minimax.js src/services/storage.js src/components/BatchGenerate/index.jsx
git commit -m "refactor: switch frontend services to use server proxy, remove client-side API keys"
```

---

### Task 10: Update Settings Page — Remove API Key Fields for Non-Admin

**Files:**
- Modify: `src/components/Settings/index.jsx`

- [ ] **Step 1: Rewrite src/components/Settings/index.jsx**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import StorageInfo from '../StorageInfo'

export default function Settings() {
  const {
    lang, setLang,
    currency, setCurrency,
    t
  } = useApp()

  const [saved, setSaved] = useState(false)

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">{t('settings.title')}</h2>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">{t('settings.language')}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setLang('zh'); showSaved() }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => { setLang('en'); showSaved() }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            English
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">费用货币</h3>
        <div className="flex gap-2">
          {[
            { id: 'CNY', label: '人民币 (¥)' },
            { id: 'SGD', label: '新币 (S$)' },
            { id: 'USD', label: '美元 ($)' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => { setCurrency(c.id); showSaved() }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currency === c.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">本地存储</h3>
        <StorageInfo />
      </section>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {t('settings.saved')}
        </div>
      )}
    </div>
  )
}
```

Removed: API Key input fields, save path/folder selection. These are now admin-only via AdminPanel.

- [ ] **Step 2: Commit**

```bash
git add src/components/Settings/index.jsx
git commit -m "refactor: remove API key and save path from Settings (now admin-only)"
```

---

### Task 11: Admin Panel Component

**Files:**
- Create: `src/components/AdminPanel/index.jsx`

- [ ] **Step 1: Create src/components/AdminPanel/index.jsx**

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../context/AppContext'

export default function AdminPanel() {
  const { t } = useApp()
  const [codes, setCodes] = useState([])
  const [config, setConfig] = useState({})
  const [newLabel, setNewLabel] = useState('')
  const [newCount, setNewCount] = useState(1)
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [minimaxKeyInput, setMinimaxKeyInput] = useState('')
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [message, setMessage] = useState('')

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const fetchCodes = useCallback(async () => {
    const res = await fetch('/api/admin/codes')
    const data = await res.json()
    setCodes(data.codes || [])
  }, [])

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/admin/config')
    const data = await res.json()
    setConfig(data.config || {})
  }, [])

  useEffect(() => {
    fetchCodes()
    fetchConfig()
  }, [fetchCodes, fetchConfig])

  const handleCreateCodes = async () => {
    const res = await fetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, count: newCount, is_admin: newIsAdmin })
    })
    const data = await res.json()
    if (data.created?.length) {
      showMessage(`${t('admin.created')} ${data.created.length} ${t('admin.codes')}`)
      setNewLabel('')
      setNewCount(1)
      setNewIsAdmin(false)
      fetchCodes()
    }
  }

  const handleToggleEnabled = async (id, currentEnabled) => {
    await fetch(`/api/admin/codes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !currentEnabled })
    })
    fetchCodes()
  }

  const handleUnbind = async (id) => {
    await fetch(`/api/admin/codes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unbind: true })
    })
    fetchCodes()
  }

  const handleDelete = async (id) => {
    if (!confirm(t('admin.confirmDelete'))) return
    await fetch(`/api/admin/codes/${id}`, { method: 'DELETE' })
    fetchCodes()
  }

  const handleSaveConfig = async () => {
    const body = {}
    if (minimaxKeyInput) body.minimax_api_key = minimaxKeyInput
    if (geminiKeyInput) body.gemini_api_key = geminiKeyInput

    if (Object.keys(body).length === 0) return

    await fetch('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setMinimaxKeyInput('')
    setGeminiKeyInput('')
    fetchConfig()
    showMessage(t('settings.saved'))
  }

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '-'

  return (
    <div className="space-y-8">
      {/* API Key Configuration */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">{t('admin.apiConfig')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MiniMax Key {config.minimax_api_key && <span className="text-gray-400">({t('admin.current')}: {config.minimax_api_key})</span>}
            </label>
            <input
              type="password"
              value={minimaxKeyInput}
              onChange={(e) => setMinimaxKeyInput(e.target.value)}
              placeholder={t('admin.enterNewKey')}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini Key {config.gemini_api_key && <span className="text-gray-400">({t('admin.current')}: {config.gemini_api_key})</span>}
            </label>
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder={t('admin.enterNewKey')}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSaveConfig}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {t('admin.saveConfig')}
          </button>
        </div>
      </div>

      {/* Code Management */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">{t('admin.codeManagement')}</h2>

        {/* Generate new codes */}
        <div className="flex flex-wrap gap-3 items-end mb-6 pb-6 border-b">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('admin.label')}</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t('admin.labelPlaceholder')}
              className="px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('admin.count')}</label>
            <select
              value={newCount}
              onChange={(e) => setNewCount(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
            />
            <span className="text-sm">{t('admin.isAdmin')}</span>
          </label>
          <button
            onClick={handleCreateCodes}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            {t('admin.generate')}
          </button>
        </div>

        {/* Codes table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-4">{t('admin.code')}</th>
                <th className="pb-2 pr-4">{t('admin.label')}</th>
                <th className="pb-2 pr-4">{t('admin.role')}</th>
                <th className="pb-2 pr-4">MAC</th>
                <th className="pb-2 pr-4">{t('admin.status')}</th>
                <th className="pb-2 pr-4">{t('admin.lastLogin')}</th>
                <th className="pb-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-4 font-mono">{c.code}</td>
                  <td className="py-3 pr-4">{c.label || '-'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${c.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{c.mac || '-'}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs ${c.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.enabled ? t('admin.enabled') : t('admin.disabled')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-500">{formatDate(c.last_login)}</td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleEnabled(c.id, c.enabled)}
                        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                      >
                        {c.enabled ? t('admin.disable') : t('admin.enable')}
                      </button>
                      {c.mac && (
                        <button
                          onClick={() => handleUnbind(c.id)}
                          className="px-2 py-1 text-xs rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
                        >
                          {t('admin.unbind')}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-2 py-1 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700"
                      >
                        {t('admin.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {message}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminPanel/index.jsx
git commit -m "feat: add admin panel with code management and API Key config"
```

---

### Task 12: Update i18n Translation Files

**Files:**
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: Update src/i18n/zh.json**

Add these new keys to the JSON (merge with existing content):

```json
{
  "app": {
    "title": "Gemini 批量生图",
    "tabs": {
      "generate": "批量生图",
      "history": "历史记录",
      "settings": "设置",
      "admin": "管理后台"
    }
  },
  "auth": {
    "loginHint": "请输入登录码",
    "codePlaceholder": "输入登录码",
    "loginButton": "登录",
    "loggingIn": "登录中...",
    "logout": "退出"
  },
  "admin": {
    "apiConfig": "模型 API 配置",
    "current": "当前",
    "enterNewKey": "输入新 Key（留空则不修改）",
    "saveConfig": "保存配置",
    "codeManagement": "登录码管理",
    "label": "备注",
    "labelPlaceholder": "如：设计部小王",
    "count": "数量",
    "isAdmin": "管理员权限",
    "generate": "生成登录码",
    "code": "登录码",
    "role": "角色",
    "status": "状态",
    "lastLogin": "最后登录",
    "actions": "操作",
    "enabled": "启用",
    "disabled": "禁用",
    "enable": "启用",
    "disable": "禁用",
    "unbind": "解绑",
    "delete": "删除",
    "confirmDelete": "确定要删除这个登录码吗？",
    "created": "已生成",
    "codes": "个登录码"
  }
}
```

Keep all existing keys (`generate`, `progress`, `history`, `settings`, `errors`) unchanged. Only add `app.tabs.admin`, `auth.*`, and `admin.*`.

- [ ] **Step 2: Update src/i18n/en.json**

Add the same structure in English:

```json
{
  "app": {
    "tabs": {
      "admin": "Admin"
    }
  },
  "auth": {
    "loginHint": "Enter your login code",
    "codePlaceholder": "Enter login code",
    "loginButton": "Login",
    "loggingIn": "Logging in...",
    "logout": "Logout"
  },
  "admin": {
    "apiConfig": "Model API Configuration",
    "current": "Current",
    "enterNewKey": "Enter new key (leave empty to keep current)",
    "saveConfig": "Save Configuration",
    "codeManagement": "Login Code Management",
    "label": "Label",
    "labelPlaceholder": "e.g. Designer Wang",
    "count": "Count",
    "isAdmin": "Admin privileges",
    "generate": "Generate Codes",
    "code": "Code",
    "role": "Role",
    "status": "Status",
    "lastLogin": "Last Login",
    "actions": "Actions",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "enable": "Enable",
    "disable": "Disable",
    "unbind": "Unbind",
    "delete": "Delete",
    "confirmDelete": "Are you sure you want to delete this code?",
    "created": "Created",
    "codes": "code(s)"
  }
}
```

- [ ] **Step 3: Also update the error messages** — change `errors.noMinimaxKey` and `errors.noGeminiKey` in both files to reference admin configuration instead of Settings:

In `zh.json`:
```json
"errors": {
  "noMinimaxKey": "MiniMax Key 未配置，请联系管理员",
  "noGeminiKey": "Gemini Key 未配置，请联系管理员"
}
```

In `en.json`:
```json
"errors": {
  "noMinimaxKey": "MiniMax Key not configured. Contact admin.",
  "noGeminiKey": "Gemini Key not configured. Contact admin."
}
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh.json src/i18n/en.json
git commit -m "feat: add auth and admin i18n translations"
```

---

### Task 13: Dockerfile & .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
server/node_modules
data
dist
.git
*.md
docs
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
RUN apk add --no-cache net-tools
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/ ./server/
COPY --from=frontend /app/dist ./dist/
RUN mkdir -p data
EXPOSE 3000
CMD ["node", "server/index.js"]
```

Note: `net-tools` is added for `arp` command availability in Alpine Linux. On Windows host with `--network=host`, the container will use the Windows ARP table directly.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for single-container deployment"
```

---

### Task 14: Vite Dev Proxy & End-to-End Verification

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Add dev proxy to vite.config.js**

Add a `server.proxy` section so that `npm run dev` proxies API calls to the Express backend during development:

In the `server` config section, add:

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true
  }
}
```

And change the server port in `server/index.js` default to `3001` for development (when frontend dev server runs on 3000):

Change in `server/index.js`:
```javascript
const PORT = process.env.PORT || 3001
```

- [ ] **Step 2: Verify dev workflow**

Terminal 1:
```bash
cd server && ADMIN_CODE=admin123 ENCRYPTION_KEY=devsecret node index.js
```
Expected: `Server running at http://0.0.0.0:3001`

Terminal 2:
```bash
npm run dev
```
Expected: Vite dev server on http://localhost:3000

Open browser to http://localhost:3000 — should see login page.

- [ ] **Step 3: Verify production build**

```bash
npm run build
PORT=3000 ADMIN_CODE=admin123 ENCRYPTION_KEY=secret node server/index.js
```
Expected: Open http://localhost:3000 → login page → enter `admin123` → main app → admin tab visible.

- [ ] **Step 4: Verify Docker build**

```bash
docker build -t gemini-batch .
docker run --rm --network=host -v $(pwd)/data:/app/data -e ENCRYPTION_KEY=secret -e ADMIN_CODE=admin123 -e PORT=3000 gemini-batch
```
Expected: App accessible at http://localhost:3000 on LAN.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js server/index.js
git commit -m "feat: add Vite dev proxy and finalize dev/prod workflow"
```
