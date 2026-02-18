/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0F9D58',
        secondary: '#F4E7BD',
        text: '#333333',
        accent: '#E0F2F1',
      },
      boxShadow: {
        card: '0 6px 20px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
