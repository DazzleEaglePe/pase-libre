import type { Metadata } from 'next';

import { Configuracion, SECCIONES, type Seccion } from '@/features/configuracion/configuracion';

export const metadata: Metadata = {
  title: 'Configuración',
  robots: { index: false },
};

/** `/cuenta/configuracion?seccion=` (C_Configuracion). */
export default async function PaginaConfiguracion({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const { seccion } = await searchParams;
  const inicial: Seccion = seccion && seccion in SECCIONES ? (seccion as Seccion) : 'datos';
  return <Configuracion seccionInicial={inicial} />;
}
