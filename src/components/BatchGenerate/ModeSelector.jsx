import { useApp } from '../../context/AppContext'

export default function ModeSelector({ mode, setMode }) {
  const { t } = useApp()

  const modes = [
    { id: 'keyword', label: t('generate.modes.keyword') },
    { id: 'reference', label: t('generate.modes.reference') },
    { id: 'direct', label: t('generate.modes.direct') },
  ]

  return (
    <div className="flex gap-2 mb-4">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === m.id
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
