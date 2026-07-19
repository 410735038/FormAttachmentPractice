/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1f2937',
        mist: '#f5f7fb',
        line: '#d9e2ec',
        teal: '#0f766e',
      },
    },
  },
  plugins: [],
};
