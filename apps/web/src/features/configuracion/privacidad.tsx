'use client';

import type { RespuestaCuenta, TiendaBloqueada } from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Interruptor } from '@/shared/ui/interruptor';

/** Configuración · Privacidad (RF-57): el «Visto» y las tiendas bloqueadas. */
export function SeccionPrivacidad({
  cuenta,
  alGuardar,
  alAvisar,
}: {
  cuenta: RespuestaCuenta;
  alGuardar: (cuenta: RespuestaCuenta, mensaje: string) => void;
  alAvisar: (mensaje: string) => void;
}) {
  const [bloqueados, setBloqueados] = useState<TiendaBloqueada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    llamarApi<TiendaBloqueada[]>('/cuenta/bloqueados').then(setBloqueados, () => setBloqueados([]));
  }, []);
  useEffect(cargar, [cargar]);

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

  async function desbloquear(bloqueo: TiendaBloqueada) {
    await llamarApi(`/cuenta/bloqueados/${bloqueo.tienda.id}`, { metodo: 'DELETE' });
    alAvisar(`Desbloqueaste a ${bloqueo.tienda.nombre}.`);
    cargar();
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

      <div className="flex flex-col gap-2">
        <b className="text-tarjeta">Bloqueados</b>
        <span className="text-apoyo text-secundario">
          Nadie de estas tiendas puede escribirte ni contactarte. No se les avisa.
        </span>
        {bloqueados === null ? (
          <p className="text-secundario">Cargando…</p>
        ) : bloqueados.length === 0 ? (
          <p className="text-secundario">No has bloqueado a nadie.</p>
        ) : (
          <ul className="flex flex-col">
            {bloqueados.map((bloqueo) => (
              <li
                key={bloqueo.tienda.id}
                className="flex items-center justify-between gap-3 border-b border-linea py-3 last:border-0"
              >
                <span className="flex flex-col">
                  <b className="font-medium">{bloqueo.tienda.nombre}</b>
                  <span className="text-nota text-detalle">
                    {bloqueo.tienda.galeria ?? 'Independiente'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void desbloquear(bloqueo)}
                  className="h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-medium"
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
