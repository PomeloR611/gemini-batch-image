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
