import { color, tipografia } from '@paselibre/ui';
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: color,
      fontFamily: {
        sans: ['var(--fuente-base)', 'system-ui', 'sans-serif'],
        // Títulos en mayúsculas (guía del lienzo final): LEMON MILK cuando se confirme su
        // licencia; mientras tanto Montserrat 800, que se ve casi igual.
        titulo: ['var(--fuente-titulo)', 'var(--fuente-base)', 'sans-serif'],
      },
      // Brasa: todo lo «en vivo» (pedir, publicar en vivo, la etiqueta EN VIVO, el contador).
      backgroundImage: {
        brasa: `linear-gradient(90deg, ${color['brasa-inicio']} 0%, ${color['brasa-fin']} 100%)`,
      },
      // Bordes de 1,5 px en tarjetas y campos (guía del lienzo final).
      borderWidth: { DEFAULT: '1.5px' },
      fontSize: tipografia as unknown as Record<string, [string, Record<string, string>]>,
    },
  },
  plugins: [],
} satisfies Config;
