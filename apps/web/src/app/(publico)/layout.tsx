import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Bienvenida } from '@/features/bienvenida/bienvenida';
import { FranjaSoporte } from '@/features/equipo/franja-soporte';
import { ProveedorEnVivo } from '@/features/en-vivo/contexto';
import { EnVivoFlotante } from '@/features/en-vivo/flotante';
import { obtenerSesion } from '@/shared/api/servidor';
import { sesionPuede } from '@/shared/permisos';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraInferior } from '@/shared/ui/barra-inferior';
import { BarraDelSitio } from '@/shared/ui/barra-del-sitio';
import { PiePagina } from '@/shared/ui/pie-pagina';
import { QueNoSePierda } from '@/shared/ui/que-no-se-pierda';

/**
 * El catálogo: portada, resultados y ficha. Lo ve cualquiera; con sesión, la barra suma la
 * campanita, Mensajes y «Mi cuenta» (con el tiempo real) y la API suma precios y tiendas.
 * El resto de la barra es el mismo con sesión y sin ella.
 */
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (sesion?.usuario.debe_cambiar_clave) redirect('/ingresar');

  const pagina = (
    <ProveedorEnVivo>
      <div className="flex min-h-dvh flex-col">
        {sesion?.soporte && <FranjaSoporte soporte={sesion.soporte} />}
        <BarraDelSitio sesion={sesion} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
          {children}
        </main>
        <PiePagina conSesion={Boolean(sesion?.tienda)} />
        {/* En vivo (D-53): aparece al entrar y sigue al usuario al bajar. */}
        <EnVivoFlotante conSesion={Boolean(sesion?.tienda)} />
        <BarraInferior
          conTienda={Boolean(sesion?.tienda)}
          sinPublicar={!sesionPuede(sesion, 'PUBLICAR')}
        />
        {sesion?.usuario.ver_bienvenida && <Bienvenida />}
        {/* Sonidos y aviso en la pestaña (doc 19, punto 22): solo la tienda, no el equipo ayudando. */}
        {sesion?.tienda && !sesion.soporte && <QueNoSePierda />}
      </div>
    </ProveedorEnVivo>
  );
  return sesion?.tienda ? (
    <ProveedorTiempoReal apagado={Boolean(sesion.soporte)}>{pagina}</ProveedorTiempoReal>
  ) : (
    pagina
  );
}
