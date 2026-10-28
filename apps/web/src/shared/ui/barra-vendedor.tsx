'use client';

import type { TiendaDeSesion } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BotonSalir } from '@/features/acceso/boton-salir';

import { Marca } from './marca';

const SECCIONES = [
  { href: '/publicar', texto: 'Publicar' },
  { href: '/mis-publicaciones', texto: 'Mis publicaciones' },
] as const;

/**
 * Barra de las páginas del vendedor. Es la parte de C_Header que ya tiene páginas
 * («¡Hola, Tienda A!», Publicar y Mis publicaciones); el buscador, Mensajes y la
 * campanita se suman cuando lleguen sus pantallas.
 */
export function BarraVendedor({ tienda }: { tienda: TiendaDeSesion }) {
  const ruta = usePathname();
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
              const activa = ruta === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activa ? 'page' : undefined}
                  className={`flex h-12 items-center border-b-2 text-apoyo no-underline ${
                    activa
                      ? 'border-tinta font-semibold'
                      : 'border-transparent font-medium text-secundario'
                  }`}
                >
                  {texto}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-apoyo">
          <span className="flex flex-col leading-tight">
            <span>
              ¡Hola, <b className="font-semibold">{tienda.nombre}</b>!
            </span>
            {lugar && <span className="text-nota text-detalle">{lugar}</span>}
          </span>
          <BotonSalir />
        </div>
      </div>
    </header>
  );
}
