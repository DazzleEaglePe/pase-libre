import type { Metadata } from 'next';

import { PanelCuentas } from '@/features/equipo/panel-cuentas';

export const metadata: Metadata = { title: 'Cuentas del piloto' };

/** `/equipo/cuentas` (RF-35, RF-49): cuentas del piloto, crear, reenviar acceso y suspender. */
export default async function PaginaCuentas({
  searchParams,
}: {
  searchParams: Promise<{ crear?: string }>;
}) {
  // «+ Crear cuenta de tienda» del inicio del panel (COR18) abre el formulario de una.
  const { crear } = await searchParams;
  return <PanelCuentas crearAlAbrir={crear === '1'} />;
}
