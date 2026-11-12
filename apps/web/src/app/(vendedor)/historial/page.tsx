import type { Metadata } from 'next';

import { PaginaHistorial } from '@/features/historial/pagina-historial';
import { obtenerSesion } from '@/shared/api/servidor';
import { sesionPuede } from '@/shared/permisos';
import { SinPermiso } from '@/shared/ui/sin-permiso';

export const metadata: Metadata = { title: 'Mis ventas y compras', robots: { index: false } };

/**
 * `/historial` (HI_A2_Web, HI_A2_Cel): las ventas y compras marcadas en el chat, por mes. Con
 * `?lado=compras` abre en Compras (el aviso «Recordarle» lleva ahí para calificar).
 */
export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ lado?: string }>;
}) {
  const { lado } = await searchParams;
  if (!sesionPuede(await obtenerSesion(), 'HISTORIAL')) {
    return <SinPermiso que="ver el historial de ventas" />;
  }
  return <PaginaHistorial ladoInicial={lado === 'compras' ? 'compras' : 'ventas'} />;
}
