import { AbrirDesdeOferta } from '@/features/mensajes/abrir-desde-oferta';

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
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-[1.5px] border-linea p-8 text-center">
      <p className="text-tarjeta">Elige una conversación</p>
      <p className="max-w-[360px] text-apoyo text-secundario">
        Para escribirle a una tienda, entra a la ficha del producto y pulsa «Enviar mensaje».
      </p>
    </section>
  );
}
