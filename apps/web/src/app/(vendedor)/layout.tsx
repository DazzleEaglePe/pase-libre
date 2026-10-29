import type { CategoriaResumen } from '@paselibre/contracts';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraVendedor } from '@/shared/ui/barra-vendedor';
import { Pie } from '@/shared/ui/pie';

/**
 * Páginas del vendedor: Publicar, Mis publicaciones y Mensajes, con el socket del tiempo
 * real para el chat y la campanita. Hace falta sesión con contraseña propia y una tienda;
 * las cuentas del equipo no tienen tienda y van a su panel. El buscador es el mismo del
 * catálogo; la fila de categorías no va aquí, para no restarle alto al chat.
 */
export default async function LayoutVendedor({ children }: { children: ReactNode }) {
  const [sesion, { cuerpo: categorias }] = await Promise.all([
    obtenerSesion(),
    consultarApi<CategoriaResumen[]>('/categorias'),
  ]);
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (!sesion.tienda) redirect('/equipo/cuentas');

  return (
    <ProveedorTiempoReal>
      <div className="flex min-h-dvh flex-col">
        <BarraVendedor tienda={sesion.tienda} categorias={categorias ?? []} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
          {children}
        </main>
        <Pie />
      </div>
    </ProveedorTiempoReal>
  );
}
