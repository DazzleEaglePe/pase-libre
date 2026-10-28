import type { RespuestaFicha, RespuestaRedireccion } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { FichaProducto } from '@/features/catalogo/ficha-producto';
import { ofertasVista } from '@/features/catalogo/ofertas';
import { consultarApi } from '@/shared/api/servidor';

/**
 * Una sola consulta por visita aunque la usen la página y el título. Un producto que se unió
 * a otro (RF-54) llega como 301: se manda a la dirección nueva.
 */
const cargarFicha = cache(async (slug: string): Promise<RespuestaFicha> => {
  const { estado, cuerpo } = await consultarApi<RespuestaFicha | RespuestaRedireccion>(
    `/productos/${encodeURIComponent(slug)}`,
  );
  if (estado === 301 && cuerpo && 'redirigir_a' in cuerpo) {
    permanentRedirect(`/p/${cuerpo.redirigir_a}`);
  }
  if (estado === 404) notFound();
  if (estado !== 200 || !cuerpo || 'redirigir_a' in cuerpo) {
    throw new Error(`No se pudo cargar el producto ${slug} (${estado})`);
  }
  return cuerpo;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { producto } = await cargarFicha(slug);
  return { title: producto.titulo };
}

/** `/p/:producto` (F_Ficha): el producto con todas sus ofertas. */
export default async function Ficha({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ficha = await cargarFicha(slug);
  const { producto } = ficha;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/buscar?categoria=${producto.categoria.slug}`} className="text-secundario">
          {producto.categoria.nombre}
        </Link>
        <span aria-hidden="true">›</span>
        <span>{producto.modelo ?? producto.titulo}</span>
      </nav>
      <FichaProducto
        key={producto.id}
        producto={producto}
        ofertas={ofertasVista(ficha)}
        audiencia={ficha.audiencia}
      />
    </div>
  );
}
