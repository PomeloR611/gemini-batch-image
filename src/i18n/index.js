import zh from './zh.json'
import en from './en.json'

const translations = { zh, en }

export function t(key, lang = 'zh') {
  const keys = key.split('.')
  let value = translations[lang]
  for (const k of keys) {
    value = value?.[k]
  }
  return value || key
}

export { zh, en }
