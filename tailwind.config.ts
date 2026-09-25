import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F3F4F6',
        panel: '#FFFFFF',
        line: '#E2E5E9',
        ink: { DEFAULT: '#16202E', muted: '#4A5565', faint: '#6B7584' },
        navy: { DEFAULT: '#1D3F6E', hover: '#173458', soft: '#E8EEF6' },
        ok: { DEFAULT: '#1F7A4D', soft: '#E6F2EB' },
        warn: { DEFAULT: '#A86A12', soft: '#FBF1E1' },
        bad: { DEFAULT: '#B3362D', soft: '#F9E7E5' },
        mark: '#FFF1B8',
        noting: '#EEF5EA',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Devanagari"', 'Segoe UI', 'Arial', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Noto Serif Devanagari"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      fontSize: { xs: ['12px', '16px'], sm: ['13px', '19px'], base: ['14px', '21px'] },
      borderRadius: { DEFAULT: '4px', md: '6px' },
    },
  },
  plugins: [],
};
export default config;
