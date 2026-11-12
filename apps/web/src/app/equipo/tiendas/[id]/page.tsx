import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PESTANAS, type Pestana } from '@/features/equipo/ficha/comun';
import { FichaDeTienda } from '@/features/equipo/ficha/ficha-tienda';

export const metadata: Metadata = { title: 'Ficha de la tienda' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/equipo/tiendas/:id?pestana=` (N14): la ficha completa de una tienda. Con `?chat=` abre un chat
 * de Conversaciones en solo lectura.
 */
export default async function PaginaFichaDeTienda({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string; chat?: string }>;
}) {
  const [{ id }, { pestana, chat }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const inicial: Pestana =
    PESTANAS.find((p) => p === pestana) ?? (chat ? 'conversaciones' : 'acceso');
  return (
    <FichaDeTienda
      tiendaId={id}
      pestanaInicial={inicial}
      chatInicial={chat && UUID.test(chat) ? chat : null}
    />
  );
}
