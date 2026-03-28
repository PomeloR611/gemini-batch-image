import { useState } from 'react'
import { base64ToBlob } from '../utils/helpers'

export default function ImagePreview({ item, onRetry }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!item.base64) return
    setLoading(true)
    try {
      const blob = base64ToBlob(item.base64, item.mimeType || 'image/png')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = item.filename || 'image.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  if (item.status === 'pending') {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">...</span>
      </div>
    )
  }

  if (item.status === 'failed') {
    return (
      <div className="aspect-square bg-red-50 rounded-lg flex flex-col items-center justify-center p-4">
        <span className="text-red-500 text-sm text-center mb-2">{item.error || 'Failed'}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden relative group">
      <img
        src={`data:${item.mimeType || 'image/png'};base64,${item.base64}`}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={handleDownload}
          disabled={loading}
          className="px-4 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          {loading ? '...' : 'Download'}
        </button>
      </div>
    </div>
  )
}
