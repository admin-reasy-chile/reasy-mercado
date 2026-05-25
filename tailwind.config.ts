import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'oklch(0.97 0.008 240)',
          100: 'oklch(0.94 0.012 240)',
          200: 'oklch(0.88 0.020 240)',
          500: 'oklch(0.55 0.14 240)',
          600: 'oklch(0.48 0.14 240)',
          700: 'oklch(0.40 0.13 240)',
          900: 'oklch(0.22 0.08 240)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
