import type { CategoriaResumen, RespuestaYo } from '@paselibre/contracts';
import Link from 'next/link';

import { BotonSalir } from '@/features/acceso/boton-salir';

import { Buscador } from './buscador';
import { Marca } from './marca';

/**
 * Barra de las páginas públicas sin tienda: la de quien mira sin sesión («Iniciar sesión»)
 * y la del equipo, que entra al catálogo desde su panel.
 */
export function BarraVisitante({
  sesion,
  categorias,
}: {
  sesion: RespuestaYo | null;
  categorias?: CategoriaResumen[];
}) {
  return (
    <header className="border-b border-linea">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-8">
        <div className="order-1">
          <Marca />
        </div>
        <Buscador
          categorias={categorias}
          className="order-3 basis-full lg:order-2 lg:max-w-[520px] lg:flex-1 lg:basis-auto"
        />
        <div className="order-2 ml-auto flex items-center gap-4 lg:order-3">
          {sesion ? (
            <>
              <Link href="/equipo/cuentas" className="text-apoyo font-medium">
                Panel del equipo
              </Link>
              <BotonSalir />
            </>
          ) : (
            <Link
              href="/ingresar"
              className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium no-underline"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
