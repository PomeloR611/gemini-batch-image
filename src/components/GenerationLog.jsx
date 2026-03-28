import { useEffect, useRef } from 'react'

export default function GenerationLog({ logs }) {
  const logEndRef = useRef(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const getLogIcon = (type) => {
    switch (type) {
      case 'info': return '○'
      case 'translating': return '◐'
      case 'success': return '✓'
      case 'error': return '✗'
      case 'generating': return '◐'
      default: return '○'
    }
  }

  const getLogColor = (type) => {
    switch (type) {
      case 'info': return 'text-gray-400'
      case 'translating': return 'text-blue-400'
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'generating': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false })
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
      {logs.length === 0 ? (
        <div className="text-gray-500">等待开始...</div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-2">
              <span className="text-gray-600 shrink-0">[{formatTime(log.time)}]</span>
              <span className={getLogColor(log.type)}>{getLogIcon(log.type)}</span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}
