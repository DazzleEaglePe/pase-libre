'use client';

import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useState } from 'react';

import { generarClave } from '@/shared/clave';

export type TipoClave = 'TEMPORAL' | 'DEFINITIVA';

/**
 * «Temporal» o «Definitiva»: la misma elección en Tienda › Acceso (N14) y en Crear cuenta
 * (doc 19, punto 6). Una tarjeta con su radio; la elegida va con borde verde.
 */
export function OpcionClave({
  nombre,
  valor,
  elegido,
  alElegir,
  titulo,
  ayuda,
}: {
  /** El `name` del grupo de radios. */
  nombre: string;
  valor: TipoClave;
  elegido: TipoClave;
  alElegir: (valor: TipoClave) => void;
  titulo: string;
  ayuda: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] px-4 py-3 ${
        elegido === valor ? 'border-pase bg-pase-suave' : 'border-linea'
      }`}
    >
      <input
        type="radio"
        name={nombre}
        checked={elegido === valor}
        onChange={() => alElegir(valor)}
        className="mt-1 h-5 w-5 accent-pase"
      />
      <span className="flex flex-col">
        <b className="font-bold">{titulo}</b>
        <span className="text-nota text-secundario">{ayuda}</span>
      </span>
    </label>
  );
}

/**
 * El campo de la contraseña definitiva, con el ojito para verla. Con `conGenerar`, debajo dice
 * «Al menos 8 caracteres y un número · Generar una».
 */
export function CampoClave({
  id,
  etiqueta,
  valor,
  alCambiar,
  clases,
  conGenerar = false,
  etiquetaOculta = false,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** Las del campo de cada formulario. */
  clases: string;
  conGenerar?: boolean;
  /** Cuando la etiqueta ya se lee arriba (la «Contraseña» de Crear cuenta). */
  etiquetaOculta?: boolean;
}) {
  const [ver, setVer] = useState(true);
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-apoyo font-bold">
      {etiquetaOculta ? <span className="sr-only">{etiqueta}</span> : etiqueta}
      <span className="relative">
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          required
          minLength={8}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          className={`${clases} pr-12 font-normal`}
        />
        <button
          type="button"
          aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          onClick={() => setVer(!ver)}
          className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-secundario"
        >
          {ver ? (
            <IconEye size={19} stroke={1.7} aria-hidden="true" />
          ) : (
            <IconEyeOff size={19} stroke={1.7} aria-hidden="true" />
          )}
        </button>
      </span>
      {conGenerar && (
        <span className="text-nota font-normal text-secundario">
          Al menos 8 caracteres y un número ·{' '}
          <button
            type="button"
            onClick={() => {
              alCambiar(generarClave());
              setVer(true);
            }}
            className="font-semibold text-pase-texto underline"
          >
            Generar una
          </button>
        </span>
      )}
    </label>
  );
}
