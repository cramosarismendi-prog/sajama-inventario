import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './locales/es.json'
import zh from './locales/zh.json'

i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, zh: { translation: zh } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false }
})
export default i18n
