import { base64ToBlob } from '../utils/helpers'

export async function saveImageToFolder(filename, base64, mimeType) {
  const blob = base64ToBlob(base64, mimeType)
  return downloadViaBrowser(blob, filename)
}

export async function downloadViaBrowser(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

export function addToHistory(setHistory, task) {
  setHistory(prev => [task, ...prev])
}

export function clearHistory(setHistory) {
  setHistory([])
}
