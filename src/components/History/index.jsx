import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/helpers'
import { clearHistory } from '../../services/storage'

export default function History() {
  const { history, setHistory, t } = useApp()
  const [expandedTasks, setExpandedTasks] = useState({})

  const handleClearAll = () => {
    if (confirm(t('history.clearAll') + '?')) {
      clearHistory(setHistory)
    }
  }

  const toggleExpand = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }))
  }

  const modeLabels = {
    keyword: t('generate.modes.keyword'),
    reference: t('generate.modes.reference'),
    direct: t('generate.modes.direct'),
  }

  // 费用计算常量
  const MINIMAX_PRICE_PER_1K = 0.1
  const GEMINI_PRICE_PER_1K = 0.01

  const calcCost = (usage) => {
    if (!usage) return { minimaxCost: 0, geminiCost: 0, total: 0 }
    const minimaxCost = (usage.minimaxTokens / 1000) * MINIMAX_PRICE_PER_1K
    const geminiCost = (usage.geminiCalls / 1000) * GEMINI_PRICE_PER_1K
    return {
      minimaxCost,
      geminiCost,
      total: minimaxCost + geminiCost
    }
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center text-gray-400 py-12">
          {t('history.empty')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('app.tabs.history')}</h2>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm"
        >
          {t('history.clearAll')}
        </button>
      </div>

      {history.map((task) => {
        const costs = calcCost(task.usage)
        return (
          <div key={task.id} className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-sm text-gray-500">{formatDate(task.date)}</div>
                <div className="font-medium">{modeLabels[task.mode]}</div>
                <div className="text-sm text-gray-600 mt-1 truncate max-w-md">{task.input}</div>
              </div>
              <div className="text-right">
                <div className="text-green-600">{task.successCount} {t('history.successCount')}</div>
                {task.failedCount > 0 && (
                  <div className="text-red-600">{task.failedCount} {t('history.failedCount')}</div>
                )}
              </div>
            </div>

            {/* LLM 开销信息 */}
            {task.usage && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <div className="font-medium text-gray-700 mb-2">LLM 开销</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <span className="text-gray-500">MiniMax 调用:</span>
                    <span className="ml-1 font-medium">{task.usage.minimaxCalls} 次</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Token:</span>
                    <span className="ml-1 font-medium">{task.usage.minimaxTokens.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gemini 调用:</span>
                    <span className="ml-1 font-medium">{task.usage.geminiCalls} 次</span>
                  </div>
                  <div>
                    <span className="text-gray-500">预估费用:</span>
                    <span className="ml-1 font-medium text-green-600">¥{costs.total.toFixed(4)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  MiniMax: ¥{costs.minimaxCost.toFixed(4)} | Gemini: ¥{costs.geminiCost.toFixed(4)}
                </div>
              </div>
            )}

            {/* 翻译后的 Prompt */}
            {task.translatedPrompts && task.translatedPrompts.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => toggleExpand(task.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>{expandedTasks[task.id] ? '▼' : '▶'}</span>
                  查看翻译后的 Prompt ({task.translatedPrompts.length} 条)
                </button>

                {expandedTasks[task.id] && (
                  <div className="mt-2 space-y-2">
                    {task.translatedPrompts.map((prompt, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="text-gray-500 mb-1">原文 {index + 1}: {prompt.original}</div>
                        <div className="font-mono text-gray-800 whitespace-pre-wrap">{prompt.translated}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 生成结果列表 */}
            {task.results.length > 0 && (
              <div>
                <div className="text-sm text-gray-500 mb-2">{t('history.results')}</div>
                <div className="space-y-1">
                  {task.results.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded ${
                        item.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <span className={item.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                        {item.status === 'success' ? '✓' : '✗'}
                      </span>
                      <span className="text-sm text-gray-600 truncate flex-1">
                        {item.filename || item.prompt?.slice(0, 50) || 'Unknown'}
                      </span>
                      {item.status === 'failed' && item.error && (
                        <span className="text-xs text-red-500">{item.error}</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">图片已保存到本地文件夹</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
