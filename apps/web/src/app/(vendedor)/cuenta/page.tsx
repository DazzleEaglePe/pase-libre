import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { TuCuenta } from '@/features/cuenta/tu-cuenta';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Tu cuenta', robots: { index: false } };

/** `/cuenta` (D_Cuenta, M_Cuenta): tu tienda, atajos, WhatsApp, avisos y ayuda. */
export default async function Cuenta() {
  const sesion = await obtenerSesion();
  if (!sesion?.tienda) redirect('/ingresar');
  return <TuCuenta tienda={sesion.tienda} />;
}
