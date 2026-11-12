import type { Metadata } from 'next';

import { Ayuda } from '@/features/informacion/ayuda';
import { obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Ayuda',
  description: 'Respuestas a lo que más se pregunta sobre PaseLibre: cuentas, publicar y mensajes.',
};

/** `/ayuda`: preguntas frecuentes. */
export default async function PaginaAyuda() {
  const sesion = await obtenerSesion();
  return <Ayuda conTienda={Boolean(sesion?.tienda)} />;
}
