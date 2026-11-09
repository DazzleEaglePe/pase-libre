import type { Metadata } from 'next';
import type { RespuestaSolicitudesEquipo } from '@paselibre/contracts';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { SeccionesDelPanel } from '@/features/equipo/secciones';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
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
  // Cuántas solicitudes esperan, para la insignia de la sección. Con el registro apagado, 0.
  const { cuerpo: solicitudes } = await consultarApi<RespuestaSolicitudesEquipo>(
    '/equipo/solicitudes?estado=PENDIENTE',
  );

  return (
    <MarcoPagina sesion={sesion}>
      {/* Las secciones del panel, bajo la barra de siempre. En el celular la barra no trae
          «Salir», así que va aquí. */}
      <div className="border-b border-linea">
        <div className="mx-auto flex min-h-12 max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 sm:px-8">
          <SeccionesDelPanel porRevisar={solicitudes?.resumen.pendientes ?? 0} />
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
