import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { obtenerSesion } from '@/shared/api/servidor';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { ContenidoMenuCuenta } from '@/shared/ui/menu-cuenta';

export const metadata: Metadata = { title: 'Tu cuenta', robots: { index: false } };

/**
 * `/cuenta/menu` (COR22_MenuCel): el menú de la cuenta en el celular, donde lleva «Cuenta» de la
 * barra de abajo. En la computadora el mismo menú se abre desde el nombre de la tienda.
 */
export default async function MenuDeLaCuenta() {
  const sesion = await obtenerSesion();
  // El layout ya manda a ingresar a quien no tiene tienda.
  if (!sesion?.tienda) redirect('/ingresar');
  const { tienda } = sesion;
  const lugar = [tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      <CabeceraMovil titulo={`Tu cuenta · ${tienda.nombre}`} />
      <h1 className="text-titulo max-md:hidden">Tu cuenta</h1>
      <div className="rounded-[24px] border border-linea bg-superficie p-3 shadow-[0_12px_30px_rgba(20,22,26,0.08)]">
        <ContenidoMenuCuenta
          tienda={tienda}
          lugar={lugar}
          permisos={sesion.usuario.permisos}
          soporte={Boolean(sesion.soporte)}
        />
      </div>
    </div>
  );
}
