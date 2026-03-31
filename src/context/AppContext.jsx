import { createContext, useContext, useState, useEffect } from 'react'
import { t as translate } from '../i18n'
import { getMe } from '../services/auth'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh')
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'CNY')
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('history')
    return saved ? JSON.parse(saved) : []
  })
  const [activeTab, setActiveTab] = useState('generate')

  // Auth state
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Check session on mount
  useEffect(() => {
    getMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('currency', currency)
  }, [currency])

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history))
  }, [history])

  const value = {
    lang, setLang,
    currency, setCurrency,
    history, setHistory,
    activeTab, setActiveTab,
    user, setUser,
    authLoading,
    t: (key) => translate(key, lang)
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
