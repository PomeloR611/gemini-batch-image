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
