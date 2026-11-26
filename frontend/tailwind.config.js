/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16241F',
          light:   '#233830',
          deep:    '#101B17',
          pale:    '#EEF2F0',
        },
        accent: {
          DEFAULT: '#E4D825',
        },
        surface: {
          bg:     '#F4F6F5',
          card:   '#FFFFFF',
          border: '#E2E7E4',
          hover:  '#F8FAF9',
        },
        success:   { DEFAULT: '#15803D', pale: '#DCFCE7' },
        warning:   { DEFAULT: '#B45309', pale: '#FEF3C7' },
        danger:    { DEFAULT: '#DC2626', pale: '#FEE2E2' },
      },
      fontFamily: { sans: ['Inter', 'Arial', 'sans-serif'] }
    }
  },
  plugins: []
}
