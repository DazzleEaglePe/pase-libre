import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FormularioPublicar } from '@/features/publicar/formulario-publicar';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Publicar',
  robots: { index: false },
};

/**
 * `/publicar` (F_Publicar): con `?igual=<producto>` llega con el producto elegido desde la
 * ficha, y con `?editar=<oferta>` es la edición desde Mis publicaciones.
 */
export default async function PaginaPublicar({
  searchParams,
}: {
  searchParams: Promise<{ igual?: string; editar?: string }>;
}) {
  const sesion = await obtenerSesion();
  if (!sesion?.tienda) redirect('/ingresar');
  const { igual, editar } = await searchParams;

  return (
    <>
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        {editar ? (
          <>
            <Link href="/mis-publicaciones" className="text-secundario">
              Mis publicaciones
            </Link>
            <span aria-hidden="true">›</span>
            <span>Editar</span>
          </>
        ) : (
          <span>Publicar</span>
        )}
      </nav>
      {/* La llave reinicia el formulario al pasar de editar a publicar sin recargar. */}
      <FormularioPublicar
        key={editar ?? igual ?? 'nuevo'}
        tienda={sesion.tienda}
        igual={igual}
        editar={editar}
      />
    </>
  );
}
