
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**/*",
    "!./dist/**/*",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        primary: '#000000',
        vermilion: '#F22C2C', 
      }
    },
  },
  plugins: [],
}
