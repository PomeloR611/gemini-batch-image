import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import ModeSelector from './ModeSelector'
import KeywordMode from './KeywordMode'
import ReferenceMode from './ReferenceMode'
import DirectPromptMode from './DirectPromptMode'
import ImagePreview from '../ImagePreview'
import ProgressBar from '../ProgressBar'
import UsageStats from '../UsageStats'
import GenerationLog from '../GenerationLog'
import { translateWithMinimax } from '../../services/minimax'
import { generateImageWithGemini } from '../../services/gemini'
import { saveImageToFolder, addToHistory } from '../../services/storage'
import { generateId, sleep } from '../../utils/helpers'
import { getDraftImage } from '../../services/db'

const DRAFT_KEY = 'gemini_batch_draft'
const REFERENCE_IMAGE_KEY = 'reference_image'

export default function BatchGenerate() {
  const {
    minimaxKey, geminiKey, savePath, dirHandle,
    history, setHistory,
    t
  } = useApp()

  // 从 LocalStorage 恢复草稿
  const [draft, setDraft] = useState(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    return saved ? JSON.parse(saved) : {
      mode: 'keyword',
      keywordInput: '',
      referenceImage: null,
      referenceImageId: null,
      referenceDesc: '',
      directInput: '',
      imageCount: 1,
      translatedPrompts: [],
      step: 'input'
    }
  })

  const [results, setResults] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' })
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState([])

  // LLM 使用统计
  const [usageStats, setUsageStats] = useState({
    minimaxCalls: 0,
    minimaxTokens: 0,
    geminiCalls: 0
  })

  // 解构草稿
  const { 
    mode, setMode, 
    keywordInput, setKeywordInput, 
    referenceImage, setReferenceImage, 
    referenceImageId, setReferenceImageId,
    referenceDesc, setReferenceDesc, 
    directInput, setDirectInput, 
    imageCount, setImageCount, 
    translatedPrompts, setTranslatedPrompts, 
    step, setStep 
  } = draft

  // 页面加载时从 IndexedDB 恢复参考图
  useEffect(() => {
    const restoreImage = async () => {
      if (referenceImageId && !referenceImage) {
        try {
          const stored = await getDraftImage(referenceImageId)
          if (stored) {
            setReferenceImage(stored.base64)
          }
        } catch (e) {
          console.error('Failed to restore image from IndexedDB:', e)
        }
      }
    }
    restoreImage()
  }, [])

  // 保存草稿到 LocalStorage
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date(), message, type }])
  }

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

    const prompts = parsePrompts()
    if (prompts.length === 0) return

    setStep('translating')
    setTranslatedPrompts([])
    setProgress({ current: 0, total: prompts.length, status: 'translating' })
    setUsageStats({ minimaxCalls: 0, minimaxTokens: 0, geminiCalls: 0 })
    setLogs([])
    addLog(`开始翻译 ${prompts.length} 条 Prompt...`, 'info')

    const translated = []
    let totalTokens = 0
    let callCount = 0

    for (let i = 0; i < prompts.length; i++) {
      const promptInput = prompts[i]
      addLog(`翻译中: ${promptInput.slice(0, 30)}${promptInput.length > 30 ? '...' : ''}`, 'translating')
      
      if (mode === 'direct') {
        translated.push({ original: promptInput, translated: promptInput, editing: promptInput })
        addLog(`跳过翻译（直接粘贴模式）`, 'info')
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
        translated.push({ original: promptInput, translated: result.text, editing: result.text })
        totalTokens += result.usage.totalTokens
        callCount++
        addLog(`翻译完成`, 'success')
      } catch (e) {
        console.error('Translation failed:', e)
        addLog(`翻译失败: ${e.message}`, 'error')
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
    addLog(`翻译完成，共 ${callCount} 条成功`, 'success')
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
    setLogs([])
    addLog(`开始生成 ${translatedPrompts.length * imageCount} 张图片...`, 'info')

    const taskId = generateId()
    const allResults = []
    const timestamp = Date.now()
    let geminiCallCount = 0

    for (let i = 0; i < translatedPrompts.length; i++) {
      const item = translatedPrompts[i]
      const promptToUse = item.editing || item.translated

      for (let j = 0; j < imageCount; j++) {
        const imageIndex = i * imageCount + j + 1
        setProgress(p => ({ ...p, current: imageIndex }))
        addLog(`[${imageIndex}/${translatedPrompts.length * imageCount}] 生成中...`, 'generating')

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
              addLog(`生成失败: ${e.message}`, 'error')
              allResults.push({
                id: `${taskId}_${i}_${j}`,
                status: 'failed',
                error: e.message,
                prompt: item.original,
                translatedPrompt: promptToUse
              })
              break
            }
            addLog(`正在重试 (${retryCount}/${maxRetries})...`, 'translating')
            await sleep(3000 * retryCount)
          }
        }

        if (imageData) {
          setProgress(p => ({ ...p, status: 'saving' }))
          const filename = `gemini_${timestamp}_${String(imageIndex).padStart(3, '0')}.png`
          addLog(`保存图片: ${filename}`, 'translating')

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
            addLog(`✓ 已保存: ${filename}`, 'success')
          } catch (e) {
            console.error('Save failed:', e)
            addLog(`保存失败: ${e.message}`, 'error')
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

        setProgress(p => ({ ...p, current: imageIndex, status: 'generating' }))
      }
    }

    setUsageStats(prev => ({
      ...prev,
      geminiCalls: geminiCallCount
    }))

    setResults(allResults)
    setProgress(p => ({ ...p, status: 'completed', current: allResults.length }))
    setStep('done')

    const successCount = allResults.filter(r => r.status === 'success').length
    const failedCount = allResults.filter(r => r.status === 'failed').length
    addLog(`任务完成! 成功 ${successCount} 张${failedCount > 0 ? `, 失败 ${failedCount} 张` : ''}`, 'success')

    const finalStats = {
      minimaxCalls: usageStats.minimaxCalls,
      minimaxTokens: usageStats.minimaxTokens,
      geminiCalls: geminiCallCount
    }

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
    addLog(`重试生成中...`, 'translating')

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
      addLog(`✓ 重试成功: ${filename}`, 'success')
      
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
      addLog(`重试失败: ${e.message}`, 'error')
    }

    setResults([...newResults])
  }

  const handleBackToInput = () => {
    setStep('input')
    setTranslatedPrompts([])
    setResults([])
    setProgress({ current: 0, total: 0, status: 'idle' })
    setLogs([])
  }

  const updatePromptEditing = (index, newValue) => {
    const updated = [...translatedPrompts]
    updated[index].editing = newValue
    setTranslatedPrompts(updated)
  }

  const updateDraft = (updates) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }

  const renderModeInput = () => {
    switch (mode) {
      case 'keyword':
        return <KeywordMode input={keywordInput} setInput={(v) => updateDraft({ keywordInput: v })} />
      case 'reference':
        return (
          <ReferenceMode
            imageBase64={referenceImage}
            setImageBase64={(v) => updateDraft({ referenceImage: v })}
            imageId={referenceImageId}
            setImageId={(v) => updateDraft({ referenceImageId: v })}
            description={referenceDesc}
            setDescription={(v) => updateDraft({ referenceDesc: v })}
          />
        )
      case 'direct':
        return <DirectPromptMode input={directInput} setInput={(v) => updateDraft({ directInput: v })} />
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
          <ModeSelector mode={mode} setMode={(m) => updateDraft({ mode: m })} />

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

      {/* 生成中/完成 - 左右分栏 */}
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

          {/* 左右分栏布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {/* 左侧：日志 */}
            <div className="lg:col-span-1">
              <GenerationLog logs={logs} />
            </div>
            
            {/* 右侧：进度 + 图片网格 */}
            <div className="lg:col-span-2">
              {progress.status !== 'idle' && (
                <div className="mb-4">
                  <ProgressBar
                    current={progress.current}
                    total={progress.total}
                    status={progress.status}
                  />
                </div>
              )}

              {results.length > 0 && (
                <div className="text-sm text-gray-500 mb-4">
                  {results.filter(r => r.status === 'success').length} {t('history.successCount')}, {results.filter(r => r.status === 'failed').length} {t('history.failedCount')}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((item, index) => (
                  <ImagePreview
                    key={item.id}
                    item={item}
                    onRetry={item.status === 'failed' ? () => handleRetry(item, index) : null}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
