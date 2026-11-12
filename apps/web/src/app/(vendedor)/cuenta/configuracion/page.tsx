import type { Metadata } from 'next';

import { Configuracion, type Seccion } from '@/features/configuracion/configuracion';

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
  const { seccion } = await searchParams;
  const inicial = SECCIONES_VALIDAS.find((valida) => valida === seccion) ?? 'datos';
  return <Configuracion seccionInicial={inicial} />;
}
