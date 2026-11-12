import type { CategoriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FormularioEnVivo } from '@/features/en-vivo/publicar';
import { consultarApi, consultarApiCompartida, obtenerSesion } from '@/shared/api/servidor';
import { sesionPuede } from '@/shared/permisos';
import { SinPermiso } from '@/shared/ui/sin-permiso';

export const metadata: Metadata = {
  title: 'Publicar un pedido en vivo',
  robots: { index: false },
};

/**
 * `/pedidos-en-vivo/publicar` (EV_Publicar, RF-24 y RF-72): un busco o un remate. Desde
 * «Publicar un busco» de la búsqueda llega `?que=` con lo buscado y, si había, `?categoria=`.
 */
export default async function PublicarPedidoEnVivo({
  searchParams,
}: {
  searchParams: Promise<{ que?: string | string[]; categoria?: string | string[] }>;
}) {
  const { que, categoria } = await searchParams;
  const [sesion, { estado }, { cuerpo: categorias }] = await Promise.all([
    obtenerSesion(),
    consultarApi('/en-vivo/mios'),
    consultarApiCompartida<CategoriaResumen[]>('/categorias'),
  ]);
  if (!sesion?.tienda) redirect('/ingresar');
  if (estado === 404) notFound();
  if (!sesionPuede(sesion, 'EN_VIVO')) return <SinPermiso que="publicar en vivo" />;

  return (
    <>
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/pedidos-en-vivo" className="text-secundario">
          Pedidos en vivo
        </Link>
        <span aria-hidden="true">›</span>
        <span>Publicar</span>
      </nav>
      <FormularioEnVivo
        categorias={categorias ?? []}
        usuarioId={sesion.usuario.id}
        tienda={sesion.tienda}
        inicial={{
          texto: (Array.isArray(que) ? que[0] : que)?.trim() ?? '',
          categoria: (Array.isArray(categoria) ? categoria[0] : categoria) ?? '',
        }}
      />
    </>
  );
}
