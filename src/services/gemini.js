export async function generateImageWithGemini(prompt) {
  const response = await fetch('/api/proxy/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()

  const parts = data.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      }
    }
  }

  throw new Error('No image in response')
}
