import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PanelPublicaciones } from '@/features/mis-publicaciones/panel-publicaciones';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Mis publicaciones',
  robots: { index: false },
};

/** `/mis-publicaciones` (F_MisPublicaciones): las ofertas de la tienda de la sesión. */
export default async function PaginaMisPublicaciones() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/ingresar');
  return <PanelPublicaciones usuarioId={sesion.usuario.id} />;
}
