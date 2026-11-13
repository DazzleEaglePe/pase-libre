import { VERSION } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { Versiones } from '@/features/equipo/versiones';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Versiones' };

/**
 * `/equipo/versiones` (docs/18 §9): todas las versiones de PaseLibre con su detalle. Abrirla
 * apaga el puntito de la versión nueva en la barra (doc 19, punto 8).
 */
export default async function PaginaVersiones() {
  const sesion = await obtenerSesion();
  return <Versiones vista={sesion?.usuario.version_vista === VERSION} />;
}
