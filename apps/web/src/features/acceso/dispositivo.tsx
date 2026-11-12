import { IconDeviceDesktop, IconDeviceMobile } from '@tabler/icons-react';

import { haceRato } from '@/shared/fechas';

/** Celular o computadora, por el nombre de la sesión («Chrome en Android»). */
export function IconoDispositivo({
  dispositivo,
  size = 20,
}: {
  dispositivo: string;
  size?: number;
}) {
  const Icono = /Android|iPhone|iPad/.test(dispositivo) ? IconDeviceMobile : IconDeviceDesktop;
  return <Icono size={size} stroke={1.7} aria-hidden="true" />;
}

/** «Ahora · Lima», «Hace 2 h · Lima» (N10). */
export function cuandoYDonde(sesion: { ultimo_uso: string; lugar?: string }, actual = false) {
  const cuando = actual ? 'Ahora' : haceRato(sesion.ultimo_uso);
  return sesion.lugar ? `${cuando} · ${sesion.lugar}` : cuando;
}
