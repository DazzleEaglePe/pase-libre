import type { Metadata } from 'next';

import { PanelCuentas } from '@/features/equipo/panel-cuentas';

export const metadata: Metadata = { title: 'Cuentas del piloto' };

/** `/equipo/cuentas` (RF-35, RF-49): cuentas del piloto, crear, reenviar acceso y suspender. */
export default function PaginaCuentas() {
  return <PanelCuentas />;
}
