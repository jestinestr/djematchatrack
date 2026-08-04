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
          800: '#1E4239',
          900: '#132C26',
        },
        // Warm ivory backgrounds
        cream: {
          50:  '#FDFCF9',
          100: '#F5F1E8',
          200: '#EDE5D4',
          300: '#E1D5BF',
          400: '#CEC0A4',
          500: '#B5A585',
        },
        // 🍓 Strawberry accent palette
        berry: {
          50:  '#FFF0F2',
          100: '#FFD6DC',
          200: '#FFB3BE',
          300: '#FF8A9A',
          400: '#FF6478',
          500: '#F43F5E', // main strawberry red
          600: '#E11D48',
          700: '#BE123C',
        },
        // Pastel accent colors for badges/tags
        pastel: {
          sage:    '#C8DED7',
          mint:    '#B8D8CC',
          peach:   '#F5D9C4',
          rose:    '#FFD6DC',
          sky:     '#C4D9EE',
          lavender:'#D5CEE8',
          amber:   '#F0D9A8',
          berry:   '#FFB3BE',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft':    '0 2px 12px 0 rgba(30,66,57,0.07)',
        'soft-md': '0 4px 20px 0 rgba(30,66,57,0.10)',
        'soft-lg': '0 8px 32px 0 rgba(30,66,57,0.12)',
        // Clay shadows
        'clay':    '0 4px 0 0 rgba(30,66,57,0.15), 0 2px 12px rgba(30,66,57,0.08)',
        'clay-sm': '0 2px 0 0 rgba(30,66,57,0.12), 0 1px 6px rgba(30,66,57,0.06)',
        'clay-berry': '0 4px 0 0 rgba(244,63,94,0.25), 0 2px 12px rgba(244,63,94,0.10)',
      },
      keyframes: {
        'berry-bounce': {
          '0%, 100%': { transform: 'translateY(0) rotate(-4deg) scale(1)' },
          '50%':       { transform: 'translateY(-18px) rotate(4deg) scale(1.12)' },
        },
        'shadow-shrink': {
          '0%, 100%': { transform: 'scaleX(1)', opacity: '0.15' },
          '50%':       { transform: 'scaleX(0.55)', opacity: '0.07' },
        },
        'dot-wave': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%':            { transform: 'translateY(-6px)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%':      { transform: 'rotate(2deg)' },
        },
        'pop-in': {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '70%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
      },
      animation: {
        'berry-bounce':  'berry-bounce 0.9s ease-in-out infinite',
        'shadow-shrink': 'shadow-shrink 0.9s ease-in-out infinite',
        'dot-wave-1':    'dot-wave 1.2s ease-in-out infinite 0s',
        'dot-wave-2':    'dot-wave 1.2s ease-in-out infinite 0.15s',
        'dot-wave-3':    'dot-wave 1.2s ease-in-out infinite 0.3s',
        'float':         'float 3s ease-in-out infinite',
        'wiggle':        'wiggle 2s ease-in-out infinite',
        'pop-in':        'pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
    },
  },
  plugins: [],
};
