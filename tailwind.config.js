/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: '#f3e6c9',
        cream: '#fff6e1',
        navy: '#0f3f67',
        denim: '#14507a',
        orange: '#f4903c',
        amber: '#f5b13c',
        sun: '#f8d15a',
        coral: '#e85f3c',
        charcoal: '#1b1f2a',
      },
      fontFamily: {
        display: ['"Krona One"', 'sans-serif'],
        body: ['"Work Sans"', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 20px 60px rgba(15, 63, 103, 0.18)',
        card: '0 10px 30px rgba(0, 0, 0, 0.14)',
      },
      borderRadius: {
        pill: '999px',
        soft: '18px',
      },
      backgroundImage: {
        stripes:
          'linear-gradient(120deg, rgba(248,209,90,.8) 0%, rgba(244,176,60,.92) 22%, rgba(232,95,60,.9) 48%, rgba(244,176,60,.86) 74%, rgba(248,209,90,.82) 100%)',
      },
    },
  },
  plugins: [],
}
