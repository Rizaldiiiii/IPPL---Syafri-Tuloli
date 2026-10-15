/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        'surface-2': '#F1F5F9',
        line: '#E2E8F0',
        'line-strong': '#CBD5E1',
        ink: '#0F172A',
        'ink-2': '#475569',
        'ink-3': '#64748B',
        success: { DEFAULT: '#15803D', bg: '#DCFCE7' },
        warning: { DEFAULT: '#B45309', bg: '#FEF3C7' },
        danger: { DEFAULT: '#B91C1C', bg: '#FEE2E2' },
        info: { DEFAULT: '#1D4ED8', bg: '#DBEAFE' },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.08)',
        md: '0 4px 12px rgba(15,23,42,.08)',
        lg: '0 16px 40px rgba(15,23,42,.14)',
      },
    },
  },
  plugins: [],
};
