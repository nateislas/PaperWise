/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas:   'var(--canvas)',
        surface: {
          DEFAULT:  'var(--surface)',
          sunken:   'var(--surface-sunken)',
          hover:    'var(--surface-hover)',
          selected: 'var(--surface-selected)',
          inverse:  'var(--surface-inverse)',
        },
        ink: {
          primary:   'var(--text-primary)',
          body:      'var(--text-body)',
          secondary: 'var(--text-secondary)',
          disabled:  'var(--text-disabled)',
          inverse:   'var(--text-inverse)',
        },
        line:   { subtle: 'var(--border-subtle)', strong: 'var(--border-strong)', accent: 'var(--border-accent)' },
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)', subtle: 'var(--accent-subtle)' },
        trust: {
          strong: 'var(--trust-strong)', adequate: 'var(--trust-adequate)',
          weak: 'var(--trust-weak)', failing: 'var(--trust-failing)',
          unclear: 'var(--trust-unclear)', unavailable: 'var(--trust-unavailable)',
        },
      },
      borderRadius: { md: '6px', lg: '8px', xl: '12px' },
      boxShadow: {
        xs: 'var(--shadow-xs)', sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)', lg: 'var(--shadow-lg)',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      fontSize: {
        '2xs':  ['11px', { lineHeight: '16px' }],
        xs:     ['12px', { lineHeight: '18px' }],
        sm:     ['14px', { lineHeight: '22px' }],
        base:   ['16px', { lineHeight: '24px' }],
        xl:     ['20px', { lineHeight: '28px' }],
        '2xl':  ['24px', { lineHeight: '32px' }],
        '3xl':  ['30px', { lineHeight: '36px' }],
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.16,1,0.3,1)' },
      keyframes: {
        indeterminate: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(300%)' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
      animation: { indeterminate: 'indeterminate 1.4s ease-in-out infinite', pulseDot: 'pulseDot 2s ease-in-out infinite' },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
