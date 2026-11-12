import type { Metadata } from 'next';

import { CambiosDeLugar } from '@/features/equipo/cambios-de-lugar';
import { PanelSolicitudes } from '@/features/equipo/panel-solicitudes';

export const metadata: Metadata = { title: 'Solicitudes de cuenta' };

/**
 * `/equipo/solicitudes` (RF-04, RF-28): la cola de tiendas que pidieron su cuenta y, arriba, los
 * cambios de galería o stand que esperan al Equipo (N09).
 */
export default function PaginaSolicitudes() {
  return (
    <div className="flex flex-col gap-8">
      <CambiosDeLugar />
      <PanelSolicitudes />
    </div>
  );
}
