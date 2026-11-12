'use client';

import { useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { InvitacionPie } from '@/shared/ui/invitacion-pie';

/**
 * «¿Conoces una tienda que debería estar aquí?» al bajar hasta el final del inicio (N07, N15):
 * sobre el negro del pie, con «Invitar por WhatsApp», «Copiar enlace» y la X. La X se guarda en
 * la cuenta (no vuelve a salir en ningún dispositivo); en las demás páginas no sale.
 */
export function BannerInvitar({ cerrado }: { cerrado: boolean }) {
  const [oculto, setOculto] = useState(cerrado);
  if (oculto) return null;

  function cerrar() {
    setOculto(true);
    // Si no se guardó, vuelve a salir la próxima vez: no hay nada más que hacer aquí.
    void llamarApi('/inicio/invitar-cerrado', { metodo: 'POST', cuerpo: {} }).catch(
      () => undefined,
    );
  }

  return (
    // El negro llega de lado a lado y se junta con el pie, sin barra de desplazamiento.
    <div className="-mb-16 mt-2 bg-tinta pt-9 text-white shadow-[0_0_0_100vmax_#0F1412] [clip-path:inset(0_-100vmax)]">
      <InvitacionPie conSesion alCerrar={cerrar} />
    </div>
  );
}
