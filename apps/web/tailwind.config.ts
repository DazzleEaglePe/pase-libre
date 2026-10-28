import { color, tipografia } from '@paselibre/ui';
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: color,
      fontFamily: {
        sans: ['var(--fuente-base)', 'system-ui', 'sans-serif'],
      },
      fontSize: tipografia as unknown as Record<string, [string, Record<string, string>]>,
    },
  },
  plugins: [],
} satisfies Config;
