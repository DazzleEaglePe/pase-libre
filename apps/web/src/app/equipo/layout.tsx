import { VERSION, type RespuestaInicioEquipo } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { BotonTema, SeccionesDelPanel } from '@/features/equipo/secciones';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';

export const metadata: Metadata = {
  title: { default: 'Equipo', template: '%s · Equipo · PaseLibre' },
  robots: { index: false },
};

/**
 * Panel del equipo (ADM_Web, sección 20 del lienzo final): solo para cuentas con rol EQUIPO.
 * Su propia barra negra con las secciones y lo que espera en cada una. Claro u oscuro según tu
 * cuenta (COR17, COR18).
 */
export default async function LayoutEquipo({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (sesion.usuario.rol !== 'EQUIPO') notFound();
  const { cuerpo: inicio } = await consultarApi<RespuestaInicioEquipo>('/equipo/inicio');

  return (
    <div
      className={`flex min-h-dvh flex-col bg-fondo ${sesion.usuario.tema_oscuro ? 'panel-oscuro' : ''}`}
    >
      <header className="sticky top-0 z-30 bg-tinta text-white">
        <div className="mx-auto flex min-h-[60px] max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-8">
          <span className="flex shrink-0 items-center gap-2">
            <Marca sobreMarca href="/equipo" />
            <span className="rounded-full bg-contador px-2 py-0.5 text-nota font-bold text-tinta">
              Equipo
            </span>
          </span>
          <SeccionesDelPanel
            solicitudes={inicio?.solicitudes ?? 0}
            reportes={inicio?.reportes.abiertos ?? 0}
            chats={inicio?.chats ?? 0}
            catalogo={inicio?.catalogo_por_revisar ?? 0}
            galerias={inicio?.galerias_nuevas ?? 0}
          />
          <BotonTema oscuro={sesion.usuario.tema_oscuro} />
          <span className="flex shrink-0 items-center gap-3 text-apoyo">
            <span className="text-white/80">{sesion.usuario.nombre}</span>
            <BotonSalir oscuro />
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-7 sm:px-8">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1440px] justify-end px-4 pb-6 text-nota text-secundario sm:px-8">
        <Link href="/equipo/versiones" className="hover:text-tinta hover:underline">
          Versión {VERSION} · <span className="underline underline-offset-2">Ver cambios</span>
        </Link>
      </footer>
    </div>
  );
}
