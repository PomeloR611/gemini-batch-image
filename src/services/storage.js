import { base64ToBlob } from '../utils/helpers'

export async function saveImageToFolder(dirHandle, filename, base64, mimeType) {
  const blob = base64ToBlob(base64, mimeType)
  
  // dirHandle 可能为空或不是有效的 DirectoryHandle（页面刷新后会丢失）
  // 如果没有有效的 dirHandle，降级为浏览器下载
  if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') {
    console.warn('No valid dirHandle, using browser download')
    return downloadViaBrowser(blob, filename)
  }

  try {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return { success: true, method: 'folder' }
  } catch (e) {
    console.warn('Failed to save to folder, falling back to browser download:', e.message)
    return downloadViaBrowser(blob, filename)
  }
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
