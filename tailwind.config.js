/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)'
      },
      fontFamily: { sans: ['var(--font-ui)'] },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateX(24px) scale(.96)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-ring': { '0%': { transform: 'scale(.8)', opacity: '.7' }, '100%': { transform: 'scale(2)', opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } }
      },
      animation: {
        'toast-in': 'toast-in .28s cubic-bezier(.2,.8,.2,1)',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        shimmer: 'shimmer 1.6s infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
