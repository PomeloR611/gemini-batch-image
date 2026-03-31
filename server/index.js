const express = require('express')
const path = require('path')
const session = require('express-session')
const { getDb } = require('./services/db')

const app = express()
const PORT = process.env.PORT || 3001

// Init DB
getDb()

// Body parsing
app.use(express.json({ limit: '50mb' }))

// Session with SQLite store
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

// API routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/proxy', require('./routes/proxy'))
app.use('/api/admin', require('./routes/admin'))

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
