/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 主色系 — 暖琥珀·珊瑚渐变 (现代大气)
        warmth: {
          50:  '#fffaf5',
          100: '#fff2e6',
          200: '#ffe4cc',
          300: '#ffcca3',
          400: '#ffaf70',
          500: '#f58b3d',
          600: '#e06a1e',
          700: '#b85218',
          800: '#8f4118',
          900: '#6b3218',
          950: '#451e0d',
        },
        // 辅助色系 — 深靛蓝 (深度与信任)
        indigo: {
          50:  '#f4f5fb',
          100: '#e4e7f6',
          200: '#c9cfee',
          300: '#a0abe1',
          400: '#7785d1',
          500: '#5b66c0',
          600: '#484fa5',
          700: '#3b3f85',
          800: '#31356a',
          900: '#2b2e58',
          950: '#1a1c37',
        },
        // 点缀色 — 金琥珀 (亮点)
        amber: {
          50:  '#fffdf5',
          100: '#fff9e0',
          200: '#fff2b8',
          300: '#ffe680',
          400: '#ffd43b',
          500: '#f5c000',
          600: '#d9a000',
          700: '#b38000',
          800: '#8f6600',
          900: '#6b4d00',
        },
        // 点缀色 — 翡翠绿 (生长、自然)
        emerald: {
          50:  '#f2fbf6',
          100: '#d9f2e4',
          200: '#b3e5c9',
          300: '#80d1a5',
          400: '#4db87f',
          500: '#2d9d5f',
          600: '#1f7e4a',
          700: '#1b643c',
          800: '#185031',
          900: '#144229',
          950: '#0a2416',
        },
        // 点缀色 — 玫瑰 (温馨)
        rose: {
          50:  '#fdf4f6',
          100: '#fae7ea',
          200: '#f5d0d8',
          300: '#ecaab8',
          400: '#e0788f',
          500: '#d44d68',
          600: '#ba3050',
          700: '#9b2441',
          800: '#81213a',
          900: '#6c1f35',
          950: '#3d0d19',
        },
        // 中性色 — 暖石灰 (现代极简)
        stone: {
          50:  '#fafaf8',
          100: '#f5f4f0',
          200: '#e8e6de',
          300: '#d4d1c7',
          400: '#b0aca0',
          500: '#8f8b80',
          600: '#706c63',
          700: '#57544d',
          800: '#44423d',
          900: '#33312d',
          950: '#1c1b18',
        },
        // 保留旧 primary 别名以兼容现有代码
        primary: {
          50:  '#fffaf5',
          100: '#fff2e6',
          200: '#ffe4cc',
          300: '#ffcca3',
          400: '#ffaf70',
          500: '#f58b3d',
          600: '#e06a1e',
          700: '#b85218',
          800: '#8f4118',
          900: '#6b3218',
        },
        // 待选区 / 拼图功能色
        stash: {
          50:  '#f8f6fc',
          100: '#f0edf8',
          200: '#e2dbf3',
          300: '#c9bde8',
          400: '#a993d9',
          500: '#8b6fc7',
          600: '#7c5cbf',
          700: '#6345a8',
          800: '#513a8c',
          900: '#433273',
          950: '#281e47',
        },
        // baby 色系 — 基于 CSS 变量
        baby: {
          pink:   'var(--color-baby-pink)',
          blue:   'var(--color-baby-blue)',
          yellow: '#ffe8a1',
          green:  '#b5e8c3',
          purple: '#d4c5f0',
        },

        // ── 语义操作 / 状态色 (基于 CSS 变量，支持主题切换) ──
        brand: {
          DEFAULT: 'var(--color-brand)',
          light:   'var(--color-brand-light)',
          dark:    'var(--color-brand-dark)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          dark:    'var(--color-success-dark)',
          bg:      'var(--color-success-bg)',
          text:    'var(--color-success-text)',
          border:  'var(--color-success-border)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg:      'var(--color-warning-bg)',
          text:    'var(--color-warning-text)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          bg:      'var(--color-error-bg)',
          text:    'var(--color-error-text)',
          border:  'var(--color-error-border)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg:      'var(--color-info-bg)',
          text:    'var(--color-info-text)',
        },
        pending: {
          DEFAULT: 'var(--color-pending)',
          bg:      'var(--color-pending-bg)',
          text:    'var(--color-pending-text)',
        },
        stash: {
          DEFAULT: 'var(--color-stash)',
          bg:      'var(--color-stash-bg)',
        },
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 30px -5px rgba(245, 139, 61, 0.15)',
        'glow-lg': '0 0 50px -10px rgba(245, 139, 61, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
