import type { Metadata } from 'next';

import { Configuracion, type Seccion } from '@/features/configuracion/configuracion';
import { obtenerSesion } from '@/shared/api/servidor';
import { puede } from '@/shared/permisos';

export const metadata: Metadata = {
  title: 'Configuración',
  robots: { index: false },
};

/**
 * Las secciones que se pueden abrir con `?seccion=`. Van escritas aquí: lo que exporta un
 * componente de cliente (`SECCIONES`) en el servidor es solo una referencia, no el objeto.
 */
const SECCIONES_VALIDAS: readonly Seccion[] = [
  'datos',
  'acceso',
  'seguridad',
  'avisos',
  'privacidad',
  'preferencias',
  'asesores',
  'reportes',
  'bloqueadas',
];

/**
 * `/cuenta/configuracion?seccion=` (N09_ConfigWebTodo, REP_WebMisReportes, REP_WebBloqueadas).
 * Sin `?seccion=`, en el celular se ve el menú y en la computadora «Datos de la tienda».
 */
export default async function PaginaConfiguracion({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const [{ seccion }, sesion] = await Promise.all([searchParams, obtenerSesion()]);
  const permisos = sesion?.usuario.permisos;
  // El asesor sin permiso para los datos de la tienda empieza en «Mi acceso» (N12).
  const porDefecto: Seccion = puede(permisos, 'DATOS_TIENDA') ? 'datos' : 'acceso';
  const inicial = SECCIONES_VALIDAS.find((valida) => valida === seccion) ?? porDefecto;
  return <Configuracion seccionInicial={inicial} rol={sesion?.usuario.rol} permisos={permisos} />;
}
