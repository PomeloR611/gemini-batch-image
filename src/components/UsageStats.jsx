import { useState, useEffect } from 'react'
import { GEMINI_PRICING, fetchExchangeRates } from '../services/exchangeRate'

const CURRENCY_SYMBOLS = {
  USD: '$',
  SGD: 'S$',
  CNY: '¥',
  JPY: '¥'
}

const CURRENCY_NAMES = {
  USD: '美元',
  SGD: '新币',
  CNY: '人民币',
  JPY: '日元'
}

export default function UsageStats({ stats, currency = 'CNY' }) {
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, SGD: 1.34, CNY: 7.25, JPY: 149.5 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExchangeRates().then(rates => {
      setExchangeRates(rates)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const formatCurrency = (amountUSD) => {
    const rate = exchangeRates[currency] || 1
    const converted = amountUSD * rate
    const symbol = CURRENCY_SYMBOLS[currency] || '$'
    return `${symbol}${converted.toFixed(4)}`
  }

  const symbol = CURRENCY_SYMBOLS[currency] || '$'
  const currencyName = CURRENCY_NAMES[currency] || 'USD'

  // 计算 MiniMax 费用（基于估算：¥0.1/千token）
  const MINIMAX_PRICE_PER_1K = 0.1
  const minimaxCostCNY = (stats.minimaxTokens / 1000) * MINIMAX_PRICE_PER_1K
  const minimaxCostDisplay = currency === 'CNY'
    ? `¥${minimaxCostCNY.toFixed(4)}`
    : formatCurrency(minimaxCostCNY / 7.25) // 换算回 USD 再转目标货币

  // Gemini 费用估算（基于图片生成 USD 定价）
  // 假设平均每张图约 1K 分辨率 = $0.067
  const GEMINI_AVG_PRICE_PER_IMAGE_USD = 0.067
  const geminiCostUSD = (stats.geminiCalls || 0) * GEMINI_AVG_PRICE_PER_IMAGE_USD
  const geminiCostDisplay = formatCurrency(geminiCostUSD)

  // 总费用
  const totalUSD = (minimaxCostCNY / 7.25) + geminiCostUSD
  const totalDisplay = formatCurrency(totalUSD)

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">LLM 调用统计</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-gray-500">MiniMax 调用</div>
          <div className="text-lg font-semibold">{stats.minimaxCalls} 次</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">MiniMax Token</div>
          <div className="text-lg font-semibold">{stats.minimaxTokens.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Gemini 调用</div>
          <div className="text-lg font-semibold">{stats.geminiCalls} 次</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">预估费用</div>
          <div className="text-lg font-semibold text-green-600">{totalDisplay}</div>
        </div>
      </div>

      {stats.minimaxTokens > 0 && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-400">
          <div className="flex justify-between">
            <span>MiniMax ({currencyName}): {minimaxCostDisplay}</span>
            <span>Gemini ({currencyName}): {geminiCostDisplay}</span>
          </div>
          {loading && <div className="text-xs text-gray-400 mt-1">汇率加载中...</div>}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-400">
        * Gemini 费用基于 1K 分辨率估算，实际费用因分辨率不同可能有差异
      </div>
    </div>
  )
}
