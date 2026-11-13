import { VERSION, type RespuestaInicioEquipo } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { MenuEquipo } from '@/features/equipo/menu-equipo';
import { BotonTema, SeccionesDelPanel } from '@/features/equipo/secciones';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { Marca } from '@/shared/ui/marca';

export const metadata: Metadata = {
  title: { default: 'Equipo', template: '%s · Equipo · PaseLibre' },
  robots: { index: false },
};

/**
 * Panel del equipo (ADM_Web, sección 20 del lienzo final): solo para cuentas con rol EQUIPO.
 * Su propia barra negra con las secciones y lo que espera en cada una. Claro u oscuro según tu
 * cuenta (COR17, COR18). Al lado de «Equipo», la versión que corre, con un puntito verde hasta
 * que abres Versiones (doc 19, punto 8); a la derecha, tu menú (punto 7). Las pestañas van
 * abajo, en su propia fila (doc 20, punto 6).
 */
export default async function LayoutEquipo({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (sesion.usuario.rol !== 'EQUIPO') notFound();
  const { cuerpo: inicio } = await consultarApi<RespuestaInicioEquipo>('/equipo/inicio');

  const versionNueva = sesion.usuario.version_vista !== VERSION;

  // Con tiempo real: las respuestas de las tiendas llegan sin recargar (doc 19, A3).
  return (
    <ProveedorTiempoReal apagado={Boolean(sesion.soporte)}>
      <div
        className={`flex min-h-dvh flex-col bg-fondo ${sesion.usuario.tema_oscuro ? 'panel-oscuro' : ''}`}
      >
        {/*
          Dos pisos (doc 20, punto 6, opción A): arriba el logo, la versión y tu cuenta; abajo,
          en su propia fila, todas las pestañas. Así ninguna se corta (error 12).
        */}
        <header className="sticky top-0 z-30 bg-tinta text-white">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
            <div className="flex min-h-[60px] items-center justify-between gap-x-4 gap-y-2 py-2">
              <span className="flex min-w-0 shrink-0 items-center gap-2">
                <Marca sobreMarca href="/equipo" />
                <span className="rounded-full bg-contador px-2 py-0.5 text-nota font-bold text-tinta">
                  Equipo
                </span>
                <Link
                  href="/equipo/versiones"
                  aria-label={
                    versionNueva
                      ? `Versión ${VERSION}: hay novedades que todavía no viste`
                      : `Versión ${VERSION}`
                  }
                  className="relative rounded-full border-[1.5px] border-acento px-2.5 py-px text-[13px] font-extrabold text-acento no-underline hover:bg-acento/10"
                >
                  v{VERSION}
                  {versionNueva && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-[3px] -top-[3px] h-[9px] w-[9px] rounded-full border-2 border-tinta bg-acento"
                    />
                  )}
                </Link>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <BotonTema oscuro={sesion.usuario.tema_oscuro} />
                <MenuEquipo
                  nombre={sesion.usuario.nombre}
                  usuario={sesion.usuario.usuario}
                  oscuro={sesion.usuario.tema_oscuro}
                />
              </span>
            </div>
            <div className="border-t border-white/10">
              <SeccionesDelPanel
                solicitudes={inicio?.solicitudes ?? 0}
                reportes={inicio?.reportes.abiertos ?? 0}
                chats={inicio?.chats ?? 0}
                catalogo={inicio?.catalogo_por_revisar ?? 0}
                galerias={inicio?.galerias_nuevas ?? 0}
              />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-7 sm:px-8">
          {children}
        </main>
      </div>
    </ProveedorTiempoReal>
  );
}
