import { useState, useEffect } from 'react'

export default function StorageInfo() {
  const [storageInfo, setStorageInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkStorage()
  }, [])

  const checkStorage = async () => {
    setLoading(true)
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        setStorageInfo({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
          usagePercent: estimate.quota ? Math.round((estimate.usage / estimate.quota) * 100) : 0
        })
      } else {
        setStorageInfo(null)
      }
    } catch (e) {
      console.error('Failed to get storage estimate:', e)
      setStorageInfo(null)
    }
    setLoading(false)
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const clearIndexedDB = async () => {
    if (!confirm('确定要清除所有本地存储数据吗？这将删除草稿和历史记录。')) {
      return
    }
    
    try {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
      localStorage.clear()
      await checkStorage()
      alert('已清除所有本地数据')
      window.location.reload()
    } catch (e) {
      console.error('Failed to clear storage:', e)
      alert('清除失败: ' + e.message)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400">检查存储中...</div>
  }

  if (!storageInfo) {
    return <div className="text-sm text-gray-400">浏览器不支持存储信息查询</div>
  }

  const { usage, quota, usagePercent } = storageInfo
  const free = quota - usage

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-700">本地存储使用情况</h4>
        <button
          onClick={checkStorage}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          刷新
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">已使用:</span>
          <span className="font-medium">{formatSize(usage)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">可用配额:</span>
          <span className="font-medium">{formatSize(free)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">总配额:</span>
          <span className="font-medium">{formatSize(quota)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">{usagePercent}% 已用</div>
      </div>

      <button
        onClick={clearIndexedDB}
        className="mt-4 w-full px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors"
      >
        清除所有本地数据
      </button>
    </div>
  )
}
