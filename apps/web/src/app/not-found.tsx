import { connection } from 'next/server';

import { obtenerSesion } from '@/shared/api/servidor';
import { MarcoPagina } from '@/shared/ui/marco-pagina';
import { NoEncontrada } from '@/shared/ui/no-encontrada';

/**
 * El 404 de cualquier dirección que no existe (el del catálogo está en `(publico)`): con la
 * barra y el pie de siempre, en vez de la pantalla pelada de Next.
 */
export default async function NoEncontradaGeneral() {
  // `obtenerSesion` se traga el error de `cookies()`, y sin esto Next generaría este 404 una sola
  // vez al compilar: todos verían la barra de visitante y las categorías de ese momento.
  await connection();
  const sesion = await obtenerSesion();
  // Con la clave temporal todavía se ve el catálogo como visitante (docs/08 §2).
  const visible = sesion?.usuario.debe_cambiar_clave ? null : sesion;
  return (
    <MarcoPagina sesion={visible}>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
        <NoEncontrada />
      </main>
    </MarcoPagina>
  );
}
