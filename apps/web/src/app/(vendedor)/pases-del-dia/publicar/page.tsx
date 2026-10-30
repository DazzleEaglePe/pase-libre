import type { CategoriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { FormularioEnVivo } from '@/features/en-vivo/publicar';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Publicar un pase del día',
  robots: { index: false },
};

/** `/pases-del-dia/publicar` (EV_Publicar, RF-24 y RF-72): un busco o un remate. */
export default async function PublicarPaseDelDia() {
  const [sesion, { estado }, { cuerpo: categorias }] = await Promise.all([
    obtenerSesion(),
    consultarApi('/en-vivo/mios'),
    consultarApi<CategoriaResumen[]>('/categorias'),
  ]);
  if (!sesion?.tienda) redirect('/ingresar');
  if (estado === 404) notFound();

  return (
    <>
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/pases-del-dia" className="text-secundario">
          Pases del día
        </Link>
        <span aria-hidden="true">›</span>
        <span>Publicar</span>
      </nav>
      <FormularioEnVivo
        categorias={categorias ?? []}
        usuarioId={sesion.usuario.id}
        tienda={sesion.tienda}
      />
    </>
  );
}
