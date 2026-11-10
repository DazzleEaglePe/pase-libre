import type { RespuestaInicioEquipo } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { InicioEquipo } from '@/features/equipo/inicio';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Inicio' };

/** `/equipo` (ADM_Web): lo de hoy, los números del piloto y lo último del equipo. */
export default async function PaginaEquipo() {
  // Quien no es del equipo no llega a ver esto: el layout lo manda a ingresar o da 404. La página
  // se renderiza a la vez que el layout, así que sin esta guarda la API respondería 401 o 403 y
  // quedaría un error en el registro.
  const sesion = await obtenerSesion();
  if (!sesion || sesion.usuario.debe_cambiar_clave || sesion.usuario.rol !== 'EQUIPO') return null;
  const inicio = await cargarApi<RespuestaInicioEquipo>('/equipo/inicio');
  return <InicioEquipo nombre={sesion.usuario.nombre} datos={inicio} />;
}
