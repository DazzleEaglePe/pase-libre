import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { Bienvenida } from '@/features/bienvenida/bienvenida';
import { FranjaSoporte } from '@/features/equipo/franja-soporte';
import { ProveedorEnVivo } from '@/features/en-vivo/contexto';
import { obtenerSesion } from '@/shared/api/servidor';
import { sesionPuede } from '@/shared/permisos';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraDelSitio } from '@/shared/ui/barra-del-sitio';
import { BarraInferior } from '@/shared/ui/barra-inferior';
import { Pie } from '@/shared/ui/pie';

/**
 * Páginas del vendedor: Publicar, Mis publicaciones y Mensajes, con el socket del tiempo
 * real para el chat y la campanita. Hace falta sesión con contraseña propia y una tienda;
 * las cuentas del equipo no tienen tienda y van a su panel. La barra es la misma del
 * catálogo; en Mensajes va sin banda ni franja, para no restarle alto al chat.
 */
export default async function LayoutVendedor({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (!sesion.tienda) redirect('/equipo/cuentas');

  return (
    <ProveedorTiempoReal apagado={Boolean(sesion.soporte)}>
      <ProveedorEnVivo>
        <div className="flex min-h-dvh flex-col">
          {sesion.soporte && <FranjaSoporte soporte={sesion.soporte} />}
          <BarraDelSitio sesion={sesion} />
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
            {children}
          </main>
          <Pie conSesion invitarCerrada={sesion.usuario.invitar_secciones_cerrado} />
          <BarraInferior conTienda sinPublicar={!sesionPuede(sesion, 'PUBLICAR')} />
          {sesion.usuario.ver_bienvenida && <Bienvenida />}
        </div>
      </ProveedorEnVivo>
    </ProveedorTiempoReal>
  );
}
