export default function UsageStats({ stats }) {
  // 价格常量（可调整）
  const MINIMAX_PRICE_PER_1K = 0.1  // ¥/千 token
  const GEMINI_PRICE_PER_1K = 0.01   // ¥/千 token（估算）

  const minimaxCost = (stats.minimaxTokens / 1000) * MINIMAX_PRICE_PER_1K
  const geminiCost = (stats.geminiCalls / 1000) * GEMINI_PRICE_PER_1K  // 假设每张图折算1000 token
  const totalCost = minimaxCost + geminiCost

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
          <div className="text-lg font-semibold text-green-600">
            ¥{totalCost.toFixed(4)}
          </div>
        </div>
      </div>
      
      {stats.minimaxTokens > 0 && (
        <div className="mt-3 pt-3 border-t text-xs text-gray-400">
          <span>MiniMax 费用: ¥{minimaxCost.toFixed(4)}</span>
          <span className="mx-2">|</span>
          <span>Gemini 费用: ¥{geminiCost.toFixed(4)}</span>
        </div>
      )}
    </div>
  )
}
