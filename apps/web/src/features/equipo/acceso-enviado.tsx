'use client';

import type { RespuestaAcceso } from '@paselibre/contracts';
import { useState } from 'react';

import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';

/**
 * Lo que el equipo envía por WhatsApp después de crear una cuenta o darle una clave
 * nueva. La clave solo existe en esta respuesta: si se cierra sin enviarla, hay que
 * generar otra.
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
        {acceso.cuenta.estado === 'SIN_PRIMER_INGRESO'
          ? `La cuenta de ${acceso.cuenta.nombre} quedó «Sin primer ingreso». Envíale este mensaje por WhatsApp:`
          : `${acceso.cuenta.nombre} tiene una contraseña temporal nueva. Envíale este mensaje por WhatsApp:`}
      </p>
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
            className={`${botonPrincipal} no-underline`}
          >
            Abrir WhatsApp
          </a>
        )}
        <button
          type="button"
          className={botonSecundario}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(acceso.mensaje);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? 'Copiado' : 'Copiar mensaje'}
        </button>
      </div>
      {!acceso.enlace_whatsapp && (
        <p className="text-nota text-detalle">
          Esta cuenta no tiene WhatsApp: copia el mensaje y envíalo por otro medio.
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
