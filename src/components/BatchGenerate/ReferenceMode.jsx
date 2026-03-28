import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function ReferenceMode({ imageBase64, setImageBase64, description, setDescription }) {
  const { t } = useApp()
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB)')
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1]
        setImageBase64(base64)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        {imageBase64 ? (
          <div className="relative inline-block">
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Reference"
              className="max-h-48 mx-auto rounded-lg"
            />
            <button
              onClick={() => setImageBase64(null)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <span className="text-blue-500 hover:text-blue-600">
              {uploading ? t('generate.uploading') : '点击上传参考图'}
            </span>
            <span className="block text-xs text-gray-400 mt-1">{t('generate.uploadHint')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        )}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('generate.referencePlaceholder')}
        rows={3}
        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    </div>
  )
}
