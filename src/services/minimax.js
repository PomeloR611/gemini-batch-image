const API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'

const TRANSLATION_PROMPTS = {
  keyword: `你是一个专业的AI生图Prompt翻译官。请把用户给出的主题词扩展成详细的英文AI生图Prompt。

要求：
1. 每个主题生成1条详细的英文Prompt
2. Prompt需包含：主体描述、环境背景、风格设定、光线氛围、构图角度、画面质量词
3. 回复格式：只输出Prompt本身，不要加引号、编号或解释
4. 语言：Prompt主体用英文，可在括号内保留少量中文备注

用户输入：{input}`,

  reference: `你是一个专业的AI生图Prompt翻译官。请分析用户提供的参考图和描述，生成对应的AI生图Prompt。

要求：
1. 充分理解参考图的风格、氛围、构图
2. 结合用户的描述意图，生成新的Prompt
3. Prompt需包含：主体描述、环境背景、风格设定、光线氛围、构图角度、画面质量词
4. 回复格式：只输出Prompt本身，不要加引号、编号或解释
5. 语言：Prompt主体用英文

参考图描述：{description}`
}

export async function translateWithMinimax(key, mode, input, imageBase64 = null) {
  const promptTemplate = TRANSLATION_PROMPTS[mode]
  const promptText = promptTemplate.replace('{input}', input).replace('{description}', input)

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: promptText }
  ]

  const body = {
    model: 'MiniMax-M2.7-highspeed',
    messages,
    temperature: 0.8,
    max_tokens: 500
  }

  if (imageBase64) {
    messages[1] = {
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
    body.messages = messages
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `HTTP ${response.status}`)
  }

  const data = await response.json()
  console.log('MiniMax 返回数据:', JSON.stringify(data, null, 2))
  
  // MiniMax 可能返回的结构: choices[0].message.content 或 choices[0].text
  const text = data.choices?.[0]?.message?.content?.trim() 
            || data.choices?.[0]?.text?.trim()
            || data.choices?.[0]?.message?.trim()
            || ''
  
  // 提取 token 用量
  const usage = data.usage || {}
  
  return {
    text,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    }
  }
}
