'use client';

import type { RespuestaCuenta } from '@paselibre/contracts';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Interruptor } from '@/shared/ui/interruptor';

/** Configuración · Privacidad (RF-57): el «Visto». Las bloqueadas tienen su sección. */
export function SeccionPrivacidad({
  cuenta,
  alGuardar,
}: {
  cuenta: RespuestaCuenta;
  alGuardar: (cuenta: RespuestaCuenta, mensaje: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function cambiarVisto(activo: boolean) {
    setError(null);
    try {
      const nueva = await llamarApi<RespuestaCuenta>('/cuenta', {
        metodo: 'PATCH',
        cuerpo: { mostrar_visto: activo },
      });
      alGuardar(nueva, activo ? 'Se muestra el «Visto».' : 'Ya no se muestra el «Visto».');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-linea px-4 py-3.5">
        <span className="flex flex-col">
          <b className="font-semibold">Mostrar «Visto» en los mensajes</b>
          <span className="text-apoyo text-secundario">
            Si lo apagas, tampoco ves cuándo los demás leen lo tuyo.
          </span>
        </span>
        <Interruptor
          etiqueta="Mostrar «Visto» en los mensajes"
          activo={cuenta.usuario.mostrar_visto}
          alCambiar={(activo) => void cambiarVisto(activo)}
        />
      </div>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
    </>
  );
}
