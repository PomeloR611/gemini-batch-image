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
