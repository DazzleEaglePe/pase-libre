import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import type { ReactNode } from 'react';

import { URL_SITIO } from '@/shared/sitio';

import './globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-base',
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
    <html lang="es-PE" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
