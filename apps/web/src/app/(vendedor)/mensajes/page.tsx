import { AbrirConTienda } from '@/features/mensajes/abrir-con-tienda';
import { AbrirDesdeOferta } from '@/features/mensajes/abrir-desde-oferta';
import { PanelVacio } from '@/features/mensajes/panel-vacio';

/**
 * Sin conversación elegida. Con `?oferta=<id>` es «Enviar mensaje» desde la ficha: abre
 * (o crea) el hilo con el responsable de la oferta y lleva a él. Con `?tienda=<id>`, el último
 * hilo con esa tienda.
 */
export default async function PaginaMensajes({
  searchParams,
}: {
  searchParams: Promise<{ oferta?: string; tienda?: string }>;
}) {
  const { oferta, tienda } = await searchParams;
  if (oferta) return <AbrirDesdeOferta ofertaId={oferta} />;
  // «Escribir» desde el perfil de una tienda (SG_Web).
  if (tienda && /^[0-9a-f-]{36}$/i.test(tienda)) return <AbrirConTienda tiendaId={tienda} />;
  return <PanelVacio />;
}
