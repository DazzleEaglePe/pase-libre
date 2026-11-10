import { AbrirDesdeOferta } from '@/features/mensajes/abrir-desde-oferta';
import { PanelVacio } from '@/features/mensajes/panel-vacio';

/**
 * Sin conversación elegida. Con `?oferta=<id>` es «Enviar mensaje» desde la ficha: abre
 * (o crea) el hilo con el responsable de la oferta y lleva a él.
 */
export default async function PaginaMensajes({
  searchParams,
}: {
  searchParams: Promise<{ oferta?: string }>;
}) {
  const { oferta } = await searchParams;
  if (oferta) return <AbrirDesdeOferta ofertaId={oferta} />;
  return <PanelVacio />;
}
