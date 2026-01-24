/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        // Hanya fokus pada satu animasi ini
        slideInFromBottom: {
          '0%': { transform: 'translateY(50px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        // Nama yang kita pakai di class: 'animate-slide-in-bottom'
        'slide-in-bottom': 'slideInFromBottom 1s ease-out forwards',
      },
    },
  },
  plugins: [],
}