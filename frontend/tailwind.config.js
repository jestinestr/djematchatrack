/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        matcha: {
          50: '#f2f7ec',
          100: '#e0edce',
          200: '#c2dba0',
          300: '#9dc46a',
          400: '#7aab40',
          500: '#5e8f2a',
          600: '#4a721f',
          700: '#3a5a18',
          800: '#2D5016',
          900: '#1e3710',
        },
        cream: {
          50: '#fdfcf9',
          100: '#F5F0E8',
          200: '#ece3d0',
          300: '#dfd3b8',
          400: '#ccc09a',
          500: '#b8a87c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
