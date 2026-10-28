'use client';

import type { CuentaEquipo, RespuestaCuentas, RespuestaTraspaso } from '@paselibre/contracts';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';

const ROL = { DUENO: 'Dueño', ASESOR: 'Asesor' } as const;

/** «8 publicaciones · 1 conversación», o con «y» dentro de una frase. */
export function resumenACargo(cuenta: CuentaEquipo, separador = ' · '): string | null {
  const { publicaciones, conversaciones } = cuenta.a_cargo;
  const partes = [
    publicaciones > 0 && (publicaciones === 1 ? '1 publicación' : `${publicaciones} publicaciones`),
    conversaciones > 0 &&
      (conversaciones === 1 ? '1 conversación' : `${conversaciones} conversaciones`),
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(separador) : null;
}

/** «Listo: 6 publicaciones y 2 conversaciones pasaron a Kevin S.» */
export function mensajeDeTraspaso(t: RespuestaTraspaso): string {
  const cosas = [
    t.publicaciones === 1 ? '1 publicación' : `${t.publicaciones} publicaciones`,
    t.conversaciones === 1 ? '1 conversación' : `${t.conversaciones} conversaciones`,
  ].join(' y ');
  const omitidas =
    t.omitidas > 0
      ? ` ${t.omitidas === 1 ? 'Una conversación' : `${t.omitidas} conversaciones`} donde ${t.desde.nombre} preguntó como comprador se quedan con su cuenta: ${t.hacia.nombre} ya tenía su propio hilo por esa publicación.`
      : '';
  // «Kevin S.» ya termina en punto: no se agrega otro.
  const hacia = t.hacia.nombre.endsWith('.') ? t.hacia.nombre : `${t.hacia.nombre}.`;
  return `Listo: ${cosas} pasaron a ${hacia}${omitidas}`;
}

/**
 * Traspasar (RF-71, A-11): elegir otra cuenta de la misma tienda para que le lleguen las
 * publicaciones y conversaciones de esta. Lo usual es después de suspender a un asesor que
 * dejó la tienda.
 */
export function Traspasar({
  cuenta,
  alTerminar,
  alCancelar,
}: {
  cuenta: CuentaEquipo;
  alTerminar: (traspaso: RespuestaTraspaso) => void;
  alCancelar: () => void;
}) {
  const [candidatas, setCandidatas] = useState<CuentaEquipo[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    llamarApi<RespuestaCuentas>(`/equipo/cuentas?tienda=${cuenta.tienda.id}`).then(
      ({ cuentas }) => {
        const otras = cuentas.filter((c) => c.id !== cuenta.id && c.estado !== 'SUSPENDIDA');
        setCandidatas(otras);
        setElegida(otras.find((c) => c.rol === 'DUENO')?.id ?? otras[0]?.id ?? null);
      },
      () => setError('No pudimos cargar las cuentas de la tienda.'),
    );
  }, [cuenta]);

  async function confirmar() {
    if (!elegida) return;
    setEnviando(true);
    setError(null);
    try {
      alTerminar(
        await llamarApi<RespuestaTraspaso>(`/equipo/cuentas/${cuenta.id}/traspasar`, {
          metodo: 'POST',
          cuerpo: { a_usuario_id: elegida },
        }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos hacer el traspaso.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-secundario">
        {resumenACargo(cuenta, ' y ') ?? 'Nada'} de {cuenta.nombre} pasan a otra cuenta de{' '}
        {cuenta.tienda.nombre}. Desde ahora, los mensajes de esas publicaciones le llegan a quien
        elijas.
      </p>
      {candidatas === null && !error ? (
        <p className="text-secundario">Cargando…</p>
      ) : candidatas?.length === 0 ? (
        <p className="rounded-xl bg-aviso-fondo px-3.5 py-3 text-apoyo text-aviso">
          {cuenta.tienda.nombre} no tiene otra cuenta activa. Crea un asesor para la tienda y vuelve
          a intentarlo.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Cuenta que recibe" className="flex flex-col">
          {candidatas?.map((c) => {
            const marcada = c.id === elegida;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={marcada}
                onClick={() => setElegida(c.id)}
                className="grid min-h-14 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 border-b border-linea text-left"
              >
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 rounded-full ${
                    marcada ? 'border-[6px] border-tinta' : 'border-[1.5px] border-borde-control'
                  }`}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{c.nombre}</span>
                  <span className="text-[12px] leading-4 text-detalle">
                    {ROL[c.rol]} · {c.usuario}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!elegida || enviando}
          onClick={() => void confirmar()}
          className={botonPrincipal}
        >
          {enviando ? 'Traspasando…' : 'Traspasar'}
        </button>
      </div>
    </div>
  );
}
