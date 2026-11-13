'use client';

import type { RespuestaAcceso } from '@paselibre/contracts';
import { IconBrandWhatsapp, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';

import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';

/**
 * Lo que el equipo envía por WhatsApp después de crear una cuenta o darle una clave
 * nueva: el usuario y la contraseña a la vista, con «Copiar» y «Enviar por WhatsApp» (este
 * solo si la cuenta tiene WhatsApp; doc 19, punto 6). La clave solo existe en esta respuesta:
 * si se cierra sin enviarla, hay que generar otra.
 */
export function AccesoEnviado({
  acceso,
  alTerminar,
}: {
  acceso: RespuestaAcceso;
  alTerminar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-secundario">
        {acceso.definitiva
          ? `La cuenta de ${acceso.cuenta.nombre} quedó lista con la contraseña que elegiste: entra directo, sin cambiarla.`
          : acceso.cuenta.estado === 'SIN_PRIMER_INGRESO'
            ? `La cuenta de ${acceso.cuenta.nombre} quedó «Sin primer ingreso». Envíale su usuario y su contraseña:`
            : `${acceso.cuenta.nombre} tiene una contraseña temporal nueva. Envíale este mensaje por WhatsApp:`}
      </p>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border border-linea bg-white p-4 text-apoyo">
        <dt className="text-secundario">Usuario</dt>
        <dd className="m-0 break-all font-mono font-semibold">{acceso.cuenta.usuario}</dd>
        <dt className="text-secundario">
          {acceso.definitiva ? 'Contraseña' : 'Contraseña temporal'}
        </dt>
        <dd className="m-0 break-all font-mono font-semibold">{acceso.clave_temporal}</dd>
      </dl>
      <div className="whitespace-pre-line rounded-xl bg-superficie p-4 text-apoyo leading-[21px]">
        {acceso.mensaje}
      </div>
      <p className="text-nota text-detalle">
        La contraseña no se vuelve a mostrar. Si se pierde, genera otra.
      </p>
      <div className="flex flex-wrap gap-3">
        {acceso.enlace_whatsapp && (
          <a
            href={acceso.enlace_whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={`${botonPrincipal} gap-2 no-underline`}
          >
            <IconBrandWhatsapp size={19} stroke={1.8} aria-hidden="true" />
            Enviar por WhatsApp
          </a>
        )}
        <button
          type="button"
          className={`${botonSecundario} gap-2`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(acceso.mensaje);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          <IconCopy size={18} stroke={1.8} aria-hidden="true" />
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {!acceso.enlace_whatsapp && (
        <p className="text-nota text-detalle">
          Esta cuenta no tiene WhatsApp: copia el mensaje y envíalo por otro medio. Puedes agregarlo
          después en la ficha de la tienda.
        </p>
      )}
      <button
        type="button"
        onClick={alTerminar}
        className="h-9 self-start text-apoyo font-medium underline"
      >
        Volver a la lista
      </button>
    </div>
  );
}
