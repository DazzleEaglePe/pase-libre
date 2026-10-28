import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraVendedor } from '@/shared/ui/barra-vendedor';
import { PieCompacto } from '@/shared/ui/pie-compacto';

/**
 * Páginas del vendedor: Publicar, Mis publicaciones y Mensajes, con el socket del tiempo
 * real para el chat y la campanita. Hace falta sesión con contraseña propia y una tienda;
 * las cuentas del equipo no tienen tienda y van a su panel.
 */
export default async function LayoutVendedor({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave) redirect('/ingresar');
  if (!sesion.tienda) redirect('/equipo/cuentas');

  return (
    <ProveedorTiempoReal>
      <div className="flex min-h-dvh flex-col">
        <BarraVendedor tienda={sesion.tienda} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
          {children}
        </main>
        <PieCompacto />
      </div>
    </ProveedorTiempoReal>
  );
}
