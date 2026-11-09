import type { Metadata } from 'next';

import { PanelSolicitudes } from '@/features/equipo/panel-solicitudes';

export const metadata: Metadata = { title: 'Solicitudes de cuenta' };

/** `/equipo/solicitudes` (RF-04, RF-28): la cola de tiendas que pidieron su cuenta. */
export default function PaginaSolicitudes() {
  return <PanelSolicitudes />;
}
