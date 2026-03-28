import { useApp } from '../../context/AppContext'

export default function KeywordMode({ input, setInput }) {
  const { t } = useApp()

  return (
    <div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('generate.keywordPlaceholder')}
        rows={4}
        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    </div>
  )
}
