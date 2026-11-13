import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MiCuentaDelEquipo } from '@/features/equipo/mi-cuenta';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Mi cuenta' };

/** `/equipo/mi-cuenta` (doc 19, punto 7): tus datos, tu contraseña, tus sesiones y tu rol. */
export default async function PaginaMiCuenta() {
  // La sesión ya trae nombre, usuario y correo (el layout la pidió: no cuesta otro pedido).
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/ingresar');
  const { nombre, usuario, correo } = sesion.usuario;
  return <MiCuentaDelEquipo datos={{ nombre, usuario, correo }} />;
}
