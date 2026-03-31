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
