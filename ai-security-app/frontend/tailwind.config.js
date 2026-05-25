/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8f0fe',
          100: '#c5d8f8',
          200: '#9abcf2',
          300: '#6d9eec',
          400: '#4a84e8',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e3a8a',
          800: '#1e2f6e',
          900: '#0f1923',
          950: '#080d12',
        },
        surface: {
          DEFAULT: '#0f1923',
          raised:  '#162030',
          overlay: '#1a2a3d',
          border:  '#1e3a5f',
        },
        accent: {
          blue:    '#4fa3e0',
          cyan:    '#22d3ee',
          green:   '#10b981',
          red:     '#ef4444',
          yellow:  '#f59e0b',
          purple:  '#8b5cf6',
        },
      },
      fontFamily: {
        sans:  ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:  ['IBM Plex Mono', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231e3a5f' fill-opacity='0.25'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.25), transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fadeIn 0.4s ease-out forwards',
        'slide-up':   'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
