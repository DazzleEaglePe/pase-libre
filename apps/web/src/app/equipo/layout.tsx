import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { obtenerSesion } from '@/shared/api/servidor';
import { MarcoPagina } from '@/shared/ui/marco-pagina';

export const metadata: Metadata = {
  title: { default: 'Equipo', template: '%s · Equipo · PaseLibre' },
  robots: { index: false },
};

/** Panel del equipo (F_Equipo del lienzo): solo para cuentas con rol EQUIPO. */
export default async function LayoutEquipo({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (sesion.usuario.rol !== 'EQUIPO') notFound();

  return (
    <MarcoPagina sesion={sesion}>
      {/* Las secciones del panel, bajo la barra de siempre. En el celular la barra no trae
          «Salir», así que va aquí. */}
      <div className="border-b border-linea">
        <div className="mx-auto flex min-h-12 max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 sm:px-8">
          <nav aria-label="Secciones del panel" className="flex items-center gap-5 text-apoyo">
            <span className="font-semibold">Panel del equipo</span>
            <span
              aria-current="page"
              className="flex h-12 items-center border-b-2 border-acento px-1 font-semibold"
            >
              Cuentas
            </span>
          </nav>
          <span className="flex items-center gap-4 text-apoyo md:hidden">
            <span className="text-secundario">{sesion.usuario.nombre}</span>
            <BotonSalir />
          </span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-7 sm:px-8">
        {children}
      </main>
    </MarcoPagina>
  );
}
