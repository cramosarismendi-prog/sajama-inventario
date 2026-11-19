import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'
import zh from './locales/zh.json'

const savedLang = typeof window !== 'undefined'
  ? (localStorage.getItem('app_lang') || 'es')
  : 'es'

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, zh: { translation: zh } },
  lng: savedLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false }
})

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('app_lang', lng)
  }
})

export default i18n
