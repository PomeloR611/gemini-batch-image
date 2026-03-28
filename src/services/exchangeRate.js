// 汇率服务 - 从公开 API 获取实时汇率
let cachedRates = null
let lastFetchTime = 0
const CACHE_DURATION = 60 * 60 * 1000 // 缓存1小时

// Gemini 3.1 Flash Image Preview 定价（USD）
export const GEMINI_PRICING = {
  inputPerMillion: 0.50,      // 输入 $0.50/百万token
  outputTextPerMillion: 3.00,   // 文本输出 $3.00/百万token
  outputImage: {
    '0.5K': { tokens: 747, priceUSD: 0.045 },   // 512x512
    '1K': { tokens: 1120, priceUSD: 0.067 },    // 1024x1024
    '2K': { tokens: 1680, priceUSD: 0.101 },   // 2048x2048
    '4K': { tokens: 2520, priceUSD: 0.151 },   // 4096x4096
  }
}

export async function fetchExchangeRates() {
  const now = Date.now()
  
  // 如果缓存有效，直接返回
  if (cachedRates && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedRates
  }

  try {
    // 使用 Frankfurter API (免费开源)
    const response = await fetch('https://api.frankfurter.app/latest?from=USD')
    const data = await response.json()
    
    cachedRates = {
      USD: 1,
      SGD: data.rates.SGD,
      CNY: data.rates.CNY,
      JPY: data.rates.JPY,
      timestamp: now
    }
    lastFetchTime = now
    return cachedRates
  } catch (e) {
    console.error('Failed to fetch exchange rates:', e)
    // 如果获取失败，返回默认汇率（USD基准）
    return {
      USD: 1,
      SGD: 1.34,  // 默认值
      CNY: 7.25,  // 默认值
      JPY: 149.5,
      timestamp: now
    }
  }
}

export async function convertUSD(amountUSD, targetCurrency) {
  const rates = await fetchExchangeRates()
  return amountUSD * rates[targetCurrency]
}
