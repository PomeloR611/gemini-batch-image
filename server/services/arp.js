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
