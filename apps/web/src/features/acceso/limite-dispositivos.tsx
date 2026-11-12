'use client';

import type { DetallesLimiteDispositivos } from '@paselibre/contracts';
import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';

import { conPlural } from '@/shared/plural';

import { IconoDispositivo, cuandoYDonde } from './dispositivo';

/**
 * «Ya tienes 2 sesiones abiertas» (N10): sale después de poner bien la contraseña desde un
 * tercer dispositivo. Eliges cuál cerrar (o todas) y entras; quien pierde la sesión recibe aviso.
 */
export function LimiteDispositivos({
  detalles,
  enviando,
  error,
  alCerrar,
  alCancelar,
}: {
  detalles: DetallesLimiteDispositivos;
  enviando: boolean;
  error: string | null;
  alCerrar: (cerrar: string[] | 'todas') => void;
  alCancelar: () => void;
}) {
  // La más vieja viene marcada: suele ser la que ya no se usa.
  const [elegida, setElegida] = useState<string | null>(detalles.sesiones.at(-1)?.id ?? null);
  return (
    <div className="flex flex-col gap-3.5">
      <span
        aria-hidden="true"
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#FFF4E5] text-[#9A3412]"
      >
        <IconLock size={26} stroke={1.8} />
      </span>
      <h1 className="text-[22px] font-bold leading-7">
        Ya tienes {conPlural(detalles.limite, 'sesión abierta', 'sesiones abiertas')}
      </h1>
      <p className="m-0 text-cuerpo text-secundario">
        Por seguridad, la cuenta principal de tu tienda puede estar abierta en{' '}
        <b className="font-bold text-tinta">
          {conPlural(detalles.limite, 'dispositivo', 'dispositivos')} como máximo
        </b>
        . Elige cuál cerrar para entrar aquí. Si necesitas más, escríbele al Equipo PaseLibre.
      </p>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="sr-only">Sesión que se cierra</legend>
        {detalles.sesiones.map((sesion) => {
          const marcada = elegida === sesion.id;
          return (
            <label
              key={sesion.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 ${
                marcada ? 'border-pase bg-pase-suave' : 'border-linea bg-white'
              }`}
            >
              <input
                type="radio"
                name="sesion-a-cerrar"
                value={sesion.id}
                checked={marcada}
                onChange={() => setElegida(sesion.id)}
                className="h-5 w-5 accent-pase"
              />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie">
                <IconoDispositivo dispositivo={sesion.dispositivo} />
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="font-semibold">{sesion.dispositivo}</b>
                <span className="text-nota text-secundario">{cuandoYDonde(sesion)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <button
        type="button"
        disabled={!elegida || enviando}
        onClick={() => elegida && alCerrar([elegida])}
        className="inline-flex h-12 items-center justify-center rounded-full bg-pase px-5 text-cuerpo font-semibold text-white disabled:bg-borde-control"
      >
        {enviando ? 'Entrando…' : 'Cerrar la seleccionada y entrar'}
      </button>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={enviando}
          onClick={() => alCerrar('todas')}
          className="inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-tinta bg-white px-3 text-apoyo font-semibold"
        >
          Cerrar todas y entrar
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="inline-flex h-11 items-center justify-center rounded-full bg-superficie px-3 text-apoyo font-semibold"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
