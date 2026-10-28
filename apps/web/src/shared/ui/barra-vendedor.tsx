'use client';

import type { TiendaDeSesion } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Buscador } from './buscador';
import { Campanita, useContadores } from './campanita';
import { Marca } from './marca';
import { MenuCuenta } from './menu-cuenta';

const SECCIONES = [
  { href: '/publicar', texto: 'Publicar' },
  { href: '/mis-publicaciones', texto: 'Mis publicaciones' },
  { href: '/mensajes', texto: 'Mensajes' },
] as const;

/**
 * Barra de quien tiene tienda: C_Header con el buscador, Publicar, Mis publicaciones,
 * Mensajes, la campanita y «Mi cuenta». En el celular el buscador baja a su propia fila.
 */
export function BarraVendedor({ tienda }: { tienda: TiendaDeSesion }) {
  const ruta = usePathname();
  const contadores = useContadores();
  const lugar = [tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="border-b border-linea">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-8">
        <div className="order-1">
          <Marca />
        </div>
        <Buscador className="order-3 my-1 basis-full lg:order-2 lg:max-w-[440px] lg:flex-1 lg:basis-auto" />
        <nav aria-label="Tu tienda" className="order-4 flex gap-6 lg:order-3 lg:ml-auto">
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
                  <span className="min-w-5 rounded-full bg-pase px-1.5 text-center text-[11px] font-semibold leading-5 text-white">
                    {pendientes > 9 ? '9+' : pendientes}
                    <span className="sr-only"> sin leer</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="order-2 ml-auto flex items-center gap-2 lg:order-4 lg:ml-0">
          <Campanita sinLeer={contadores.avisos} />
          <MenuCuenta tienda={tienda} lugar={lugar} />
        </div>
      </div>
    </header>
  );
}
