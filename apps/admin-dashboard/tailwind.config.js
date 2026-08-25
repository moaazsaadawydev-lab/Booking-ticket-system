/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './apps/admin-dashboard/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f8fafc',
          dark: '#090d16',
        },
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
          hoverLight: '#f1f5f9',
          hoverDark: '#1e293b',
        },
        border: {
          light: '#e2e8f0',
          dark: '#1e293b',
        },
        navy: {
          50: '#f0f6fe',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
