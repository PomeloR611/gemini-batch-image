import { useApp } from '../context/AppContext'

export default function Header() {
  const { activeTab, setActiveTab, t } = useApp()

  const tabs = [
    { id: 'generate', label: t('app.tabs.generate') },
    { id: 'history', label: t('app.tabs.history') },
    { id: 'settings', label: t('app.tabs.settings') },
  ]

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          {t('app.title')}
        </h1>
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
