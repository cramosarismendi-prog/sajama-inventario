/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:   { DEFAULT: '#1A3C6E', light: '#2E75B6', pale: '#D5E3F5' },
        success:   { DEFAULT: '#1D7044', pale: '#D6EFE0' },
        warning:   { DEFAULT: '#C55A11', pale: '#FDEBD5' },
        danger:    { DEFAULT: '#C0392B', pale: '#FADBD8' },
      },
      fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'] }
    }
  },
  plugins: []
}
