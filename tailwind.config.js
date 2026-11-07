/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./dashboard.html', './popup.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        ink: v('ink'),
        ink2: v('ink2'),
        ink3: v('ink3'),
        line: v('line'),
        accent: v('accent'),
        warn: v('warn'),
        crit: v('crit'),
        ok: v('ok'),
        expired: v('expired'),
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable Text"', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '16px'],
        xs: ['12px', '17px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
      },
      boxShadow: {
        card: '0 0 0 1px rgb(var(--line) / var(--line-a)), 0 1px 2px rgb(0 0 0 / 0.03), 0 2px 8px -2px rgb(0 0 0 / 0.04)',
        lift: '0 0 0 1px rgb(var(--line) / var(--line-a)), 0 8px 24px -8px rgb(0 0 0 / 0.14)',
        pop: '0 0 0 0.5px rgb(0 0 0 / 0.08), 0 12px 40px -8px rgb(0 0 0 / 0.25), 0 4px 12px rgb(0 0 0 / 0.08)',
      },
      keyframes: {
        in: { from: { opacity: 0, transform: 'translateY(4px) scale(.985)' }, to: { opacity: 1, transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        slide: { from: { transform: 'translateX(16px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        in: 'in .16s cubic-bezier(.2,.8,.2,1)',
        fade: 'fade .15s ease-out',
        slide: 'slide .2s cubic-bezier(.2,.8,.2,1)',
        shimmer: 'shimmer 1.2s linear infinite',
      },
    },
  },
  plugins: [],
};
