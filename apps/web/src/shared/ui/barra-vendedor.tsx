'use client';

import type { TiendaDeSesion } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Campanita, useContadores } from './campanita';
import { Marca } from './marca';
import { MenuCuenta } from './menu-cuenta';

const SECCIONES = [
  { href: '/publicar', texto: 'Publicar' },
  { href: '/mis-publicaciones', texto: 'Mis publicaciones' },
  { href: '/mensajes', texto: 'Mensajes' },
] as const;

/**
 * Barra de las páginas del vendedor. Es la parte de C_Header que ya tiene páginas
 * (Publicar, Mis publicaciones, Mensajes, la campanita y «Mi cuenta»); el buscador se
 * suma con la portada.
 */
export function BarraVendedor({ tienda }: { tienda: TiendaDeSesion }) {
  const ruta = usePathname();
  const contadores = useContadores();
  const lugar = [tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="border-b border-linea">
      <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center justify-between gap-x-8 gap-y-1 px-4 py-2 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
          <Marca />
          <nav aria-label="Tu tienda" className="flex gap-6">
            {SECCIONES.map(({ href, texto }) => {
              const activa = ruta === href || ruta.startsWith(`${href}/`);
              const pendientes = href === '/mensajes' ? contadores.mensajes : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activa ? 'page' : undefined}
                  className={`flex h-12 items-center gap-1.5 border-b-2 text-apoyo no-underline ${
                    activa
                      ? 'border-tinta font-semibold'
                      : 'border-transparent font-medium text-secundario'
                  }`}
                >
                  {texto}
                  {pendientes > 0 && (
                    <span className="min-w-5 rounded-full bg-lima px-1.5 text-center text-[11px] font-semibold leading-5 text-tinta">
                      {pendientes > 9 ? '9+' : pendientes}
                      <span className="sr-only"> sin leer</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Campanita sinLeer={contadores.avisos} />
          <MenuCuenta tienda={tienda} lugar={lugar} />
        </div>
      </div>
    </header>
  );
}
