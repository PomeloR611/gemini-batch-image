import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import StorageInfo from '../StorageInfo'

export default function Settings() {
  const {
    lang, setLang,
    currency, setCurrency,
    t
  } = useApp()

  const [saved, setSaved] = useState(false)

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">{t('settings.title')}</h2>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">{t('settings.language')}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => { setLang('zh'); showSaved() }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => { setLang('en'); showSaved() }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            English
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">费用货币</h3>
        <div className="flex gap-2">
          {[
            { id: 'CNY', label: '人民币 (¥)' },
            { id: 'SGD', label: '新币 (S$)' },
            { id: 'USD', label: '美元 ($)' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => { setCurrency(c.id); showSaved() }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currency === c.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">本地存储</h3>
        <StorageInfo />
      </section>

      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {t('settings.saved')}
        </div>
      )}
    </div>
  )
}
