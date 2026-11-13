import type { Metadata } from 'next';

import { PaginaAvisos } from '@/features/avisos/pagina-avisos';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Avisos', robots: { index: false } };

/**
 * `/avisos` (AV_Web, AV_Cel): todos los avisos y su configuración. En modo soporte, solo para
 * mirar (doc 20, A1).
 */
export default async function Avisos() {
  const sesion = await obtenerSesion();
  return (
    <PaginaAvisos
      soporte={Boolean(sesion?.soporte)}
      tienda={sesion?.soporte?.tienda ?? sesion?.tienda?.nombre}
    />
  );
}
