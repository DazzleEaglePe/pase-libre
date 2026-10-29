import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { Cabecera } from '@/shared/ui/cabecera';
import { Pie } from '@/shared/ui/pie';

/**
 * Páginas del vendedor: Publicar, Mis publicaciones y Mensajes, con el socket del tiempo
 * real para el chat y la campanita. Hace falta sesión con contraseña propia y una tienda;
 * las cuentas del equipo no tienen tienda y van a su panel. La barra es la misma del
 * catálogo; en Mensajes va sin banda ni franja, para no restarle alto al chat.
 */
export default async function LayoutVendedor({ children }: { children: ReactNode }) {
  const [sesion, { cuerpo: categorias }, { cuerpo: galerias }] = await Promise.all([
    obtenerSesion(),
    consultarApi<CategoriaResumen[]>('/categorias'),
    consultarApi<GaleriaResumen[]>('/galerias'),
  ]);
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (!sesion.tienda) redirect('/equipo/cuentas');

  return (
    <ProveedorTiempoReal>
      <div className="flex min-h-dvh flex-col">
        <Cabecera sesion={sesion} categorias={categorias ?? []} galerias={galerias ?? []} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
          {children}
        </main>
        <Pie />
      </div>
    </ProveedorTiempoReal>
  );
}
