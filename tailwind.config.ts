import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F6F8F4',
        ink: '#1E2620',
        sub: '#8A948C',
        lime: '#C6E96B',
        'lime-deep': '#9CCF3A',
        'lime-soft': '#E9F6C9',
        green: '#3E7C4A',
        coral: '#FF8A65',
        amber2: '#F5C463',
        chip: {
          peach: '#FFD9B0',
          sky: '#BFE3F5',
          lavender: '#E4DDFB',
          lime: '#DFF3C4',
        },
      },
      borderRadius: {
        card: '22px',
        field: '15px',
        pill: '99px',
      },
      boxShadow: {
        card: '0 6px 24px rgba(30,38,32,.07)',
        nav: '0 10px 30px rgba(30,38,32,.25)',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
