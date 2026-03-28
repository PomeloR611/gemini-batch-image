import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import StorageInfo from '../StorageInfo'

export default function Settings() {
  const {
    lang, setLang,
    minimaxKey, setMinimaxKey,
    geminiKey, setGeminiKey,
    savePath, setSavePath,
    t
  } = useApp()

  const [saved, setSaved] = useState(false)

  const handleSelectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker()
      setSavePath(handle.name)
      // 注意：handle 不能被序列化存储，每次页面刷新后需要重新选择
      // 可以将 handle 存在内存中，但刷新后会丢失
      window.__currentDirHandle = handle
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Failed to select folder:', e)
      }
    }
  }

  const handleSaveKeys = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">{t('settings.title')}</h2>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">{t('settings.apiKeys')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.minimaxKey')}
            </label>
            <input
              type="password"
              value={minimaxKey}
              onChange={(e) => setMinimaxKey(e.target.value)}
              onBlur={handleSaveKeys}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.geminiKey')}
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              onBlur={handleSaveKeys}
              placeholder="AIza..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">{t('settings.savePath')}</h3>
        <div className="flex items-center gap-4">
          {savePath ? (
            <>
              <span className="text-gray-600">{savePath}</span>
              <button
                onClick={handleSelectFolder}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('settings.changeFolder')}
              </button>
            </>
          ) : (
            <button
              onClick={handleSelectFolder}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {t('settings.selectFolder')}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Chrome/Edge 支持 File System Access API，可直接写入指定文件夹。
          注意：刷新页面后需要重新选择文件夹。
        </p>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-4">{t('settings.language')}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setLang('zh')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'zh' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              lang === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            English
          </button>
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
