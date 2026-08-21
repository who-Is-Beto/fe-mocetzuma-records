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
      keyframes: {
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(-16px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-16px) scale(0.96)' },
        },
        progressShrink: {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
        overlayIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(12px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        recordVanish: {
          '0%': {
            opacity: '1',
            transform: 'scale(1) translateX(0) rotate(0deg)',
            filter: 'blur(0px)',
          },
          '30%': {
            opacity: '0.9',
            transform: 'scale(0.96) translateX(14px) rotate(1.5deg)',
            filter: 'blur(1px)',
          },
          '100%': {
            opacity: '0',
            transform: 'scale(0.82) translateX(72px) rotate(4deg)',
            filter: 'blur(6px)',
          },
        },
      },
      animation: {
        'toast-in': 'toastIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'toast-out': 'toastOut 0.25s ease-in forwards',
        'progress-shrink': 'progressShrink linear forwards',
        'overlay-in': 'overlayIn 0.25s ease-out forwards',
        'modal-in': 'modalIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        'record-out': 'recordVanish 0.5s cubic-bezier(0.4,0,1,1) forwards',
      },
    },
  },
  plugins: [],
}
