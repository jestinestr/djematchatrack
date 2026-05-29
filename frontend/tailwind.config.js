/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pastel sage-teal palette
        matcha: {
          50:  '#EEF5F2',
          100: '#D5E8E1',
          200: '#AACFC3',
          300: '#7BB4A4',
          400: '#559887',
          500: '#3D7E6C',
          600: '#2E6557',
          700: '#255044',
          800: '#1E4239', // sidebar / primary buttons — deep but soft sage-teal
          900: '#132C26',
        },
        // Warm ivory backgrounds
        cream: {
          50:  '#FDFCF9',
          100: '#F5F1E8', // main page bg
          200: '#EDE5D4',
          300: '#E1D5BF',
          400: '#CEC0A4',
          500: '#B5A585',
        },
        // Pastel accent colors for badges/tags
        pastel: {
          sage:    '#C8DED7',
          mint:    '#B8D8CC',
          peach:   '#F5D9C4',
          rose:    '#F5C8CB',
          sky:     '#C4D9EE',
          lavender:'#D5CEE8',
          amber:   '#F0D9A8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft':    '0 2px 12px 0 rgba(30,66,57,0.07)',
        'soft-md': '0 4px 20px 0 rgba(30,66,57,0.10)',
        'soft-lg': '0 8px 32px 0 rgba(30,66,57,0.12)',
      },
    },
  },
  plugins: [],
};
