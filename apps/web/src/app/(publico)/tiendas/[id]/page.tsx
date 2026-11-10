import type { PerfilTienda } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PerfilDeTienda } from '@/features/tiendas/perfil-tienda';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Perfil de tienda', robots: { index: false } };

/**
 * `/tiendas/:id` (SG_Web, SG_Cel): el perfil de otra tienda, solo con sesión. Un visitante no
 * sabe qué tienda tiene qué, así que va a iniciar sesión.
 */
export default async function PaginaTienda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string }>;
}) {
  const [{ id }, { pestana }, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);
  if (!sesion) redirect('/ingresar');
  const { estado, cuerpo } = await consultarApi<PerfilTienda>(`/tiendas/${encodeURIComponent(id)}`);
  if (estado === 404 || estado === 400 || !cuerpo) notFound();

  return (
    <PerfilDeTienda
      key={cuerpo.id}
      perfil={cuerpo}
      pestanaInicial={pestana === 'opiniones' ? 'opiniones' : 'productos'}
    />
  );
}
