import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fuente-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'PaseLibre', template: '%s · PaseLibre' },
  description: 'Pases entre tiendas de la Galería Wilson: componentes de PC y periféricos.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
