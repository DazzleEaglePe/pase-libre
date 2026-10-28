import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';
import { PieCompacto } from '@/shared/ui/pie-compacto';

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
    <div className="flex min-h-dvh flex-col">
      <header className="bg-tinta text-white">
        <div className="mx-auto flex min-h-16 max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span className="flex items-center gap-2 [&_a]:text-white">
              <Marca href="/equipo/cuentas" sobreOscuro />
              <span className="text-cuerpo text-borde">· Equipo</span>
            </span>
            <nav aria-label="Secciones del panel">
              <span
                aria-current="page"
                className="flex h-16 items-center border-b-2 border-acento px-1 text-apoyo font-semibold"
              >
                Cuentas
              </span>
            </nav>
          </div>
          <span className="flex items-center gap-4 text-apoyo">
            <span className="text-borde">{sesion.usuario.nombre}</span>
            <BotonSalir oscuro />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-7 sm:px-8">
        {children}
      </main>
      <PieCompacto />
    </div>
  );
}
