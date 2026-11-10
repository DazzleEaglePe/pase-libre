import type { RespuestaInicioEquipo } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { InicioEquipo } from '@/features/equipo/inicio';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Inicio' };

/** `/equipo` (ADM_Web): lo de hoy, los números del piloto y lo último del equipo. */
export default async function PaginaEquipo() {
  const [sesion, inicio] = await Promise.all([
    obtenerSesion(),
    cargarApi<RespuestaInicioEquipo>('/equipo/inicio'),
  ]);
  return <InicioEquipo nombre={sesion?.usuario.nombre ?? ''} datos={inicio} />;
}
