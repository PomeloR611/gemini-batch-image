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
