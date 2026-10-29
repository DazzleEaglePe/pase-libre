import Link from 'next/link';

import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

import { Marca } from './marca';

interface Enlace {
  href: string;
  texto: string;
  externo?: boolean;
}

const whatsapp = enlaceWhatsappEquipo('Hola, tengo una pregunta sobre PaseLibre.');

const COLUMNAS: Array<{ titulo: string; enlaces: Enlace[] }> = [
  {
    titulo: 'PaseLibre',
    enlaces: [
      { href: '/ayuda', texto: '¿Qué es PaseLibre?' },
      { href: '/buscar', texto: 'Todas las categorías' },
      { href: '/ingresar?pestana=crear', texto: 'Pide tu cuenta' },
    ],
  },
  {
    titulo: 'Ayuda',
    enlaces: [
      { href: '/ayuda', texto: 'Preguntas frecuentes' },
      { href: '/terminos#no-intermedia', texto: 'Cómo evitar estafas' },
      // Solo cuando exista el número del equipo (docs/CHECKLIST.md §5).
      ...(whatsapp ? [{ href: whatsapp, texto: 'Escríbenos por WhatsApp', externo: true }] : []),
    ],
  },
  {
    titulo: 'Legal',
    enlaces: [
      { href: '/terminos', texto: 'Términos de uso' },
      { href: '/privacidad', texto: 'Política de privacidad' },
    ],
  },
];

const claseEnlace =
  'inline-flex min-h-6 items-center text-apoyo text-secundario no-underline hover:text-tinta hover:underline';

/**
 * Pie de página (C_Footer, elegido el 28/10): la marca, tres columnas de enlaces y el aviso
 * de que el trato es entre vendedores. «Libro de Reclamaciones» sigue sin enlace hasta
 * decidir si aplica a PaseLibre (docs/CHECKLIST.md §4).
 */
export function PiePagina() {
  return (
    <footer className="border-t border-linea bg-white">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-8 gap-y-8 px-4 pb-8 pt-10 sm:px-8 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
          <Marca />
          <p className="max-w-[280px] text-apoyo text-detalle">
            Pases entre tiendas de las galerías de Wilson.
          </p>
        </div>
        {COLUMNAS.map(({ titulo, enlaces }) => (
          <nav key={titulo} aria-label={titulo} className="flex flex-col gap-2.5">
            <h2 className="text-apoyo font-semibold">{titulo}</h2>
            {enlaces.map(({ href, texto, externo }) =>
              externo ? (
                <a
                  key={texto}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={claseEnlace}
                >
                  {texto}
                </a>
              ) : (
                <Link key={texto} href={href} className={claseEnlace}>
                  {texto}
                </Link>
              ),
            )}
            {titulo === 'Legal' && (
              <span className="inline-flex min-h-6 items-center text-apoyo text-secundario">
                Libro de Reclamaciones
              </span>
            )}
          </nav>
        ))}
      </div>
      <div className="border-t border-linea">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-nota text-detalle sm:px-8">
          <span>
            © 2026 PaseLibre. El trato es entre vendedores: PaseLibre no interviene en las ventas.
          </span>
          <span>Español (Perú)</span>
        </div>
      </div>
    </footer>
  );
}
