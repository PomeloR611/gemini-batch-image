import { AppProvider, useApp } from './context/AppContext'
import BatchGenerate from './components/BatchGenerate'
import History from './components/History'
import Settings from './components/Settings'
import Header from './components/Header'

function AppContent() {
  const { activeTab } = useApp()

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-6xl mx-auto p-6">
        {activeTab === 'generate' && <BatchGenerate />}
        {activeTab === 'history' && <History />}
        {activeTab === 'settings' && <Settings />}
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
