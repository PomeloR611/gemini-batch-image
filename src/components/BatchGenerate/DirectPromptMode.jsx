import { useApp } from '../../context/AppContext'

export default function DirectPromptMode({ input, setInput }) {
  const { t } = useApp()

  return (
    <div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('generate.directPlaceholder')}
        rows={8}
        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
      />
      <div className="mt-2 text-sm text-gray-500">
        {input ? `${input.split('\n').filter(l => l.trim()).length} prompts` : ''}
      </div>
    </div>
  )
}
