import { createContext, useContext, useState, useEffect } from 'react'
import { t } from '../i18n'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh')
  const [minimaxKey, setMinimaxKey] = useState(() => localStorage.getItem('minimaxKey') || '')
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('geminiKey') || '')
  const [savePath, setSavePath] = useState(() => localStorage.getItem('savePath') || null)
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || 'CNY')
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('history')
    return saved ? JSON.parse(saved) : []
  })
  const [activeTab, setActiveTab] = useState('generate')

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  useEffect(() => {
    localStorage.setItem('minimaxKey', minimaxKey)
  }, [minimaxKey])

  useEffect(() => {
    localStorage.setItem('geminiKey', geminiKey)
  }, [geminiKey])

  useEffect(() => {
    localStorage.setItem('savePath', savePath || '')
  }, [savePath])

  useEffect(() => {
    localStorage.setItem('currency', currency)
  }, [currency])

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history))
  }, [history])

  // dirHandle 存在 window 上，每次页面刷新后需要重新选择
  const dirHandle = window.__currentDirHandle || null

  const value = {
    lang, setLang,
    minimaxKey, setMinimaxKey,
    geminiKey, setGeminiKey,
    savePath, setSavePath,
    currency, setCurrency,
    dirHandle,
    history, setHistory,
    activeTab, setActiveTab,
    t: (key) => t(key, lang)
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}
