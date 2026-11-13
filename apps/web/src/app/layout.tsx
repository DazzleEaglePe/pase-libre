import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import { URL_SITIO } from '@/shared/sitio';

import './globals.css';

// Guía del lienzo final: Inter para todo el texto y Montserrat 800 en mayúsculas para los títulos.
// Las fuentes viven en el repo (variables, solo «latin», de @fontsource-variable 5.2.8, licencia
// OFL en `fuentes/`): así la compilación no depende de bajarlas de Google Fonts, que a veces
// falla en el CI.
const inter = localFont({
  src: './fuentes/inter.woff2',
  weight: '100 900',
  variable: '--fuente-base',
  display: 'swap',
});

const montserrat = localFont({
  src: './fuentes/montserrat.woff2',
  weight: '100 900',
  variable: '--fuente-titulo',
  display: 'swap',
});

export const metadata: Metadata = {
  // Los íconos y la vista al compartir salen de los archivos de esta carpeta (icon.svg,
  // favicon.ico, apple-icon.png y opengraph-image.png), que genera branding/.
  // Con `WEB_URL` las direcciones de la vista al compartir salen con el dominio real.
  metadataBase: new URL(URL_SITIO),
  title: { default: 'PaseLibre', template: '%s · PaseLibre' },
  description: 'Pases entre tiendas de la Galería Wilson: componentes de PC y periféricos.',
  openGraph: { siteName: 'PaseLibre', locale: 'es_PE', type: 'website' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" className={`${inter.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
