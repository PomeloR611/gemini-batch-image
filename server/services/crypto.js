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
