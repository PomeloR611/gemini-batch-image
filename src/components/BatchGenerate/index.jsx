import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import ModeSelector from './ModeSelector'
import KeywordMode from './KeywordMode'
import ReferenceMode from './ReferenceMode'
import DirectPromptMode from './DirectPromptMode'
import ImagePreview from '../ImagePreview'
import ProgressBar from '../ProgressBar'
import UsageStats from '../UsageStats'
import { translateWithMinimax } from '../../services/minimax'
import { generateImageWithGemini } from '../../services/gemini'
import { saveImageToFolder, addToHistory } from '../../services/storage'
import { generateId, sleep } from '../../utils/helpers'

export default function BatchGenerate() {
  const {
    minimaxKey, geminiKey, savePath, dirHandle,
    history, setHistory,
    t
  } = useApp()

  const [mode, setMode] = useState('keyword')
  const [keywordInput, setKeywordInput] = useState('')
  const [referenceImage, setReferenceImage] = useState(null)
  const [referenceDesc, setReferenceDesc] = useState('')
  const [directInput, setDirectInput] = useState('')
  const [imageCount, setImageCount] = useState(1)
  
  // 步骤状态: 'input' | 'translating' | 'review' | 'generating' | 'done'
  const [step, setStep] = useState('input')
  const [translatedPrompts, setTranslatedPrompts] = useState([])
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' })
  const [isRunning, setIsRunning] = useState(false)

  // LLM 使用统计
  const [usageStats, setUsageStats] = useState({
    minimaxCalls: 0,
    minimaxTokens: 0,
    geminiCalls: 0
  })

  const getInput = () => {
    if (mode === 'keyword') return keywordInput
    if (mode === 'reference') return referenceDesc
    return directInput
  }

  const parsePrompts = () => {
    const input = getInput()
    if (!input.trim()) return []
    
    if (mode === 'direct') {
      return input.split('\n').map(l => l.trim()).filter(Boolean)
    }
    
    return input.split(/[,\n]/).map(l => l.trim()).filter(Boolean)
  }

  // 步骤1: 点击翻译
  const handleTranslate = async () => {
    if (!minimaxKey) {
      alert(t('errors.noMinimaxKey'))
      return
    }
    if (!dirHandle) {
      alert(t('errors.noSavePath'))
      return
    }

    const prompts = parsePrompts()
    if (prompts.length === 0) return

    setStep('translating')
    setTranslatedPrompts([])
    setProgress({ current: 0, total: prompts.length, status: 'translating' })
    setUsageStats({ minimaxCalls: 0, minimaxTokens: 0, geminiCalls: 0 })

    const translated = []
    let totalTokens = 0
    let callCount = 0

    for (let i = 0; i < prompts.length; i++) {
      const promptInput = prompts[i]
      
      if (mode === 'direct') {
        translated.push({ original: promptInput, translated: promptInput, editing: promptInput })
        setProgress(p => ({ ...p, current: i + 1 }))
        continue
      }

      try {
        const result = await translateWithMinimax(
          minimaxKey,
          mode,
          promptInput,
          mode === 'reference' ? referenceImage : null
        )
        // result 现在是 { text, usage }
        translated.push({ original: promptInput, translated: result.text, editing: result.text })
        totalTokens += result.usage.totalTokens
        callCount++
      } catch (e) {
        console.error('Translation failed:', e)
        translated.push({ original: promptInput, translated: `翻译失败: ${e.message}`, editing: `翻译失败: ${e.message}` })
      }
      
      setProgress(p => ({ ...p, current: i + 1 }))
    }

    setUsageStats(prev => ({
      ...prev,
      minimaxCalls: callCount,
      minimaxTokens: totalTokens
    }))
    setTranslatedPrompts(translated)
    setStep('review')
  }

  // 步骤2: 编辑翻译结果后开始生成
  const handleGenerate = async () => {
    if (!geminiKey) {
      alert(t('errors.noGeminiKey'))
      return
    }

    setStep('generating')
    setResults([])
    setProgress({ current: 0, total: translatedPrompts.length * imageCount, status: 'generating' })

    const taskId = generateId()
    const allResults = []
    const timestamp = Date.now()
    let geminiCallCount = 0

    for (let i = 0; i < translatedPrompts.length; i++) {
      const item = translatedPrompts[i]
      const promptToUse = item.editing || item.translated

      for (let j = 0; j < imageCount; j++) {
        setProgress(p => ({ ...p, current: allResults.length + 1 }))

        let imageData = null
        let retryCount = 0
        const maxRetries = 2

        while (retryCount <= maxRetries) {
          try {
            imageData = await generateImageWithGemini(geminiKey, promptToUse)
            geminiCallCount++
            break
          } catch (e) {
            retryCount++
            if (retryCount > maxRetries) {
              allResults.push({
                id: `${taskId}_${i}_${j}`,
                status: 'failed',
                error: e.message,
                prompt: item.original,
                translatedPrompt: promptToUse
              })
              break
            }
            await sleep(3000 * retryCount)
          }
        }

        if (imageData) {
          setProgress(p => ({ ...p, status: 'saving' }))
          const filename = `gemini_${timestamp}_${String(i * imageCount + j + 1).padStart(3, '0')}.png`

          try {
            if (dirHandle) {
              await saveImageToFolder(dirHandle, filename, imageData.base64, imageData.mimeType)
            }
            allResults.push({
              id: `${taskId}_${i}_${j}`,
              status: 'success',
              base64: imageData.base64,
              mimeType: imageData.mimeType,
              filename,
              prompt: item.original,
              translatedPrompt: promptToUse
            })
          } catch (e) {
            console.error('Save failed:', e)
            allResults.push({
              id: `${taskId}_${i}_${j}`,
              status: 'failed',
              error: `保存失败: ${e.message}`,
              base64: imageData.base64,
              mimeType: imageData.mimeType,
              filename,
              prompt: item.original,
              translatedPrompt: promptToUse
            })
          }
        }

        setProgress(p => ({ ...p, current: allResults.length, status: 'generating' }))
      }
    }

    // 更新 Gemini 调用统计
    setUsageStats(prev => ({
      ...prev,
      geminiCalls: geminiCallCount
    }))

    setResults(allResults)
    setProgress(p => ({ ...p, status: 'completed', current: allResults.length }))
    setStep('done')

    const successCount = allResults.filter(r => r.status === 'success').length
    const failedCount = allResults.filter(r => r.status === 'failed').length

    // 获取最终的 usageStats
    const finalStats = {
      minimaxCalls: usageStats.minimaxCalls,
      minimaxTokens: usageStats.minimaxTokens,
      geminiCalls: geminiCallCount
    }

    // 历史记录不保存 base64 数据，只保存元信息
    const historyResults = allResults.map(r => ({
      id: r.id,
      status: r.status,
      error: r.error,
      filename: r.filename,
      prompt: r.prompt,
      translatedPrompt: r.translatedPrompt
    }))

    addToHistory(setHistory, {
      id: taskId,
      date: new Date().toISOString(),
      mode,
      input: getInput(),
      translatedPrompts: translatedPrompts.map(p => ({ original: p.original, translated: p.editing || p.translated })),
      results: historyResults,
      successCount,
      failedCount,
      usage: finalStats
    })
  }

  const handleRetry = async (resultItem, index) => {
    if (!geminiKey || !dirHandle) return

    const newResults = [...results]
    newResults[index] = { ...resultItem, status: 'pending' }
    setResults(newResults)

    try {
      const imageData = await generateImageWithGemini(geminiKey, resultItem.translatedPrompt)
      const filename = `gemini_${Date.now()}_${String(index + 1).padStart(3, '0')}.png`

      if (dirHandle) {
        await saveImageToFolder(dirHandle, filename, imageData.base64, imageData.mimeType)
      }

      newResults[index] = {
        ...resultItem,
        status: 'success',
        base64: imageData.base64,
        mimeType: imageData.mimeType,
        filename
      }
      
      // 更新统计
      setUsageStats(prev => ({
        ...prev,
        geminiCalls: prev.geminiCalls + 1
      }))
    } catch (e) {
      newResults[index] = {
        ...resultItem,
        status: 'failed',
        error: e.message
      }
    }

    setResults([...newResults])
  }

  const handleBackToInput = () => {
    setStep('input')
    setTranslatedPrompts([])
    setResults([])
    setProgress({ current: 0, total: 0, status: 'idle' })
  }

  const updatePromptEditing = (index, newValue) => {
    const updated = [...translatedPrompts]
    updated[index].editing = newValue
    setTranslatedPrompts(updated)
  }

  const renderModeInput = () => {
    switch (mode) {
      case 'keyword':
        return <KeywordMode input={keywordInput} setInput={setKeywordInput} />
      case 'reference':
        return (
          <ReferenceMode
            imageBase64={referenceImage}
            setImageBase64={setReferenceImage}
            description={referenceDesc}
            setDescription={setReferenceDesc}
          />
        )
      case 'direct':
        return <DirectPromptMode input={directInput} setInput={setDirectInput} />
      default:
        return null
    }
  }

  // 翻译预览/编辑界面
  const renderReviewStep = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">翻译结果预览（可编辑）</h3>
        <button
          onClick={handleBackToInput}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
        >
          返回修改输入
        </button>
      </div>
      
      {translatedPrompts.map((item, index) => (
        <div key={index} className="border rounded-lg p-4">
          <div className="text-sm text-gray-500 mb-2">
            <span className="font-medium">原文 {index + 1}:</span> {item.original}
          </div>
          <textarea
            value={item.editing}
            onChange={(e) => updatePromptEditing(index, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg font-mono text-sm resize-none"
            placeholder="翻译后的 Prompt..."
          />
        </div>
      ))}

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-sm text-gray-500">
          共 {translatedPrompts.length} 条 Prompt，预计生成 {translatedPrompts.length * imageCount} 张图片
        </span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">{t('generate.countLabel')}</label>
          <select
            value={imageCount}
            onChange={(e) => setImageCount(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg"
          >
            {[1, 2, 3, 4].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isRunning}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          isRunning
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {isRunning ? t('progress.generating') : '开始生成图片'}
      </button>
    </div>
  )

  const promptCount = parsePrompts().length

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* 常驻统计面板 */}
      <UsageStats stats={usageStats} />

      {/* 输入阶段 */}
      {step === 'input' && (
        <>
          <ModeSelector mode={mode} setMode={setMode} />

          <div className="mb-4">
            {renderModeInput()}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">{t('generate.countLabel')}</label>
              <select
                value={imageCount}
                onChange={(e) => setImageCount(Number(e.target.value))}
                className="px-3 py-2 border rounded-lg"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {promptCount > 0 && (
              <span className="text-sm text-gray-500">
                共 {promptCount} 条，预计生成 {promptCount * imageCount} 张图片
              </span>
            )}
          </div>

          <button
            onClick={handleTranslate}
            disabled={!getInput().trim()}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              !getInput().trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            翻译 Prompt
          </button>
        </>
      )}

      {/* 翻译中 */}
      {step === 'translating' && (
        <ProgressBar
          current={progress.current}
          total={progress.total}
          status={progress.status}
        />
      )}

      {/* 翻译预览/编辑 */}
      {step === 'review' && renderReviewStep()}

      {/* 生成中/完成 */}
      {(step === 'generating' || step === 'done') && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">生成结果</h3>
            <button
              onClick={handleBackToInput}
              className="px-4 py-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              新建任务
            </button>
          </div>

          {progress.status !== 'idle' && (
            <ProgressBar
              current={progress.current}
              total={progress.total}
              status={progress.status}
            />
          )}

          {results.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-4">
                {results.filter(r => r.status === 'success').length} {t('history.successCount')}, {results.filter(r => r.status === 'failed').length} {t('history.failedCount')}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((item, index) => (
                  <ImagePreview
                    key={item.id}
                    item={item}
                    onRetry={item.status === 'failed' ? () => handleRetry(item, index) : null}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
