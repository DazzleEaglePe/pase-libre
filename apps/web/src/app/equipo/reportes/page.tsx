import type { Metadata } from 'next';

import { ColaReportes } from '@/features/equipo/reportes';

export const metadata: Metadata = { title: 'Reportes' };

/** `/equipo/reportes` (REP_WebEquipo): la cola de reportes, urgentes primero. */
export default function Reportes() {
  return <ColaReportes />;
}
