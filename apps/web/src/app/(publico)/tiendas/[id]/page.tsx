import type { PerfilTienda } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PerfilDeTienda } from '@/features/tiendas/perfil-tienda';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Perfil de tienda', robots: { index: false } };

/**
 * `/tiendas/:id` (N04_PerfilA_Web, N04_PerfilB_Web): el perfil de una tienda, solo con sesión.
 * Un visitante no sabe qué tienda tiene qué, así que va a iniciar sesión, que le dice qué tienda
 * le compartieron y lo trae de vuelta aquí (COR3).
 */
export default async function PaginaTienda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string; como?: string }>;
}) {
  const [{ id }, { pestana, como }, sesion] = await Promise.all([
    params,
    searchParams,
    obtenerSesion(),
  ]);
  if (!sesion) redirect(`/ingresar?volver=${encodeURIComponent(`/tiendas/${id}`)}`);
  // «Cómo me ven» (doc 20, punto 5): tu perfil tal como lo ve otra tienda.
  const comoMeVen = como === 'otra' ? '?como_me_ven=1' : '';
  const { estado, cuerpo } = await consultarApi<PerfilTienda>(
    `/tiendas/${encodeURIComponent(id)}${comoMeVen}`,
  );
  if (estado === 404 || estado === 400 || !cuerpo) notFound();

  // Tu propia tienda se ve igual que la ven los demás, con tus botones y «Tu mes» (N04).
  return (
    <PerfilDeTienda
      key={`${cuerpo.id}-${cuerpo.como_me_ven ? 'otra' : 'yo'}`}
      perfil={cuerpo}
      pestanaInicial={
        pestana === 'opiniones' ? 'opiniones' : pestana === 'detalles' ? 'detalles' : 'productos'
      }
    />
  );
}
