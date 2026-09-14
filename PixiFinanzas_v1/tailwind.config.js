/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f3f2f2',
        surface: '#eae9e9',
        ink: '#201e1d',
        accent: {
          100: '#eef4fe',
          200: '#d6e4fb',
          300: '#a9c8f4',
          400: '#5b93e6',
          500: '#1565d8',
          600: '#0f4fac',
          700: '#0b3a8c',
        },
        teal: '#0f8f86',
        neutral: {
          100: '#f8f4f4', 200: '#eae7e7', 300: '#d7d3d3', 400: '#bab6b6',
          500: '#9b9797', 600: '#7d7979', 700: '#605d5d', 800: '#444141', 900: '#2d2b2b',
        },
        // Paleta del rediseño v2 (Figma), namespaced para no tocar los tokens
        // de arriba mientras la migración de pantallas está en curso.
        v2: {
          bg: '#0d0f14',
          surface: '#141720',
          panel: '#1a1f2e',
          border: '#232840',
          muted: '#2a3050',
          text: '#e8eaf2',
          subtle: '#7b83a6',
          accent: '#00d4aa',
          accent2: '#5b8dee',
          danger: '#ff4d6d',
          warning: '#f59e0b',
          success: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        v2sans: ['DM Sans', 'system-ui', 'sans-serif'],
        v2mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { sm: '6px', md: '8px', lg: '12px' },
    },
  },
  plugins: [],
};
