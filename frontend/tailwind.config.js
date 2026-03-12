/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tesla: {
          red: '#E31937',
          dark: '#0a0a0a',
          panel: '#111111',
          border: '#1f1f1f',
          text: '#e5e5e5',
          muted: '#6b7280',
          accent: '#3b82f6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      },
      fontFamily: {
        tesla: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      fontSize: {
        'driving': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'alert': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '500' }],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'panel': '0 4px 32px rgba(0,0,0,0.6)',
        'glow-red': '0 0 20px rgba(227,25,55,0.3)',
        'glow-blue': '0 0 20px rgba(59,130,246,0.3)',
        'glow-green': '0 0 20px rgba(34,197,94,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      backdropBlur: {
        xs: '2px',
      }
    }
  },
  plugins: []
}
