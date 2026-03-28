import { useApp } from '../context/AppContext'

export default function ProgressBar({ current, total, status }) {
  const { t } = useApp()
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  const statusLabels = {
    idle: t('progress.idle'),
    translating: t('progress.translating'),
    generating: t('progress.generating'),
    saving: t('progress.saving'),
    completed: t('progress.completed'),
  }

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{statusLabels[status] || status}</span>
        <span>{current} / {total}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
