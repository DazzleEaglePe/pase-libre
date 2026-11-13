'use client';

import {
  preguntasDeCategoria,
  type Empaque,
  type PerfilMemoria,
  type VariantesOferta,
} from '@paselibre/contracts';
import type { ReactNode } from 'react';

import { PastillasTitulo } from '@/shared/ui/tarjeta-producto';

/** «¿Para qué procesador es?» (docs/19 §13): cada opción con su color cuando está marcada. */
const PROCESADORES: Array<[PerfilMemoria, string, string]> = [
  ['XMP', 'Intel XMP · para Intel', 'border-[#1d5fd1] bg-[#E6F0FF] text-[#1d5fd1]'],
  ['EXPO', 'EXPO Ryzen · para AMD', 'border-[#e8590c] bg-[#FFF0E6] text-[#c2410c]'],
  ['AMBOS', 'Sirve para los dos', 'border-tinta bg-superficie text-tinta'],
];

/** «Intel XMP», «EXPO Ryzen» o «para los dos», para «✦ Ya viene marcado…». */
const DICE_EL_CATALOGO: Record<PerfilMemoria, string> = {
  XMP: 'es Intel XMP',
  EXPO: 'es EXPO Ryzen',
  AMBOS: 'sirve para los dos',
};

const sinMarcar = 'border-[1.5px] border-[#D6DDD9] bg-white font-semibold text-tinta';

/** Botones de una sola elección que se pueden dejar sin marcar (todo aquí es opcional). */
function Opciones<T extends string | boolean>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: Array<[T, string, string?]>;
  valor: T | null;
  alCambiar: (valor: T | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
      {opciones.map(([clave, texto, marcado]) => {
        const elegido = valor === clave;
        return (
          <button
            key={String(clave)}
            type="button"
            role="radio"
            aria-checked={elegido}
            onClick={() => alCambiar(elegido ? null : clave)}
            className={`min-h-9 rounded-full px-3 py-1.5 text-[13.5px] ${
              elegido
                ? `border-2 font-extrabold ${marcado ?? 'border-tinta bg-superficie text-tinta'}`
                : sinMarcar
            }`}
          >
            {elegido ? '✓ ' : ''}
            {texto}
          </button>
        );
      })}
    </div>
  );
}

function Titulo({ children, importante = false }: { children: ReactNode; importante?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <b className="text-[13.5px] font-bold text-[#2E3833]">{children}</b>
      {importante && (
        <span className="rounded-full bg-[#FFE8D6] px-2 py-0.5 text-[11px] font-extrabold text-[#B54708]">
          IMPORTANTE
        </span>
      )}
      <span className="text-[12.5px] text-[#8A958F]">(opcional)</span>
    </span>
  );
}

/**
 * Lo que se pregunta según la categoría, justo después de elegir el producto (docs/19 §13, A):
 * «¿Para qué procesador es?» con IMPORTANTE en las memorias RAM (marcado solo si el catálogo lo
 * sabe), OC o normal en las tarjetas de video y el empaque (Box o Tray en los procesadores).
 * Todo es opcional. Abajo, cómo queda el título con sus pastillas.
 */
export function PreguntasVariantes({
  categoria,
  titulo,
  variantes,
  alCambiar,
  delCatalogo,
}: {
  categoria: string | null | undefined;
  titulo: string;
  variantes: VariantesOferta;
  alCambiar: (variantes: VariantesOferta) => void;
  /** Lo que dice el catálogo de esta memoria, si vino marcado solo. */
  delCatalogo: PerfilMemoria | null;
}) {
  const preguntas = preguntasDeCategoria(categoria);
  if (!preguntas.procesador && !preguntas.oc && !preguntas.empaque) return null;
  const cambiar = (cambio: Partial<VariantesOferta>) => alCambiar({ ...variantes, ...cambio });
  const empaques: Array<[Empaque, string]> =
    preguntas.empaque === 'BOX_TRAY'
      ? [
          ['CAJA', 'Box (con caja)'],
          ['OEM', 'Tray (OEM)'],
        ]
      : [
          ['CAJA', 'Con caja'],
          ['OEM', 'OEM · sin caja'],
        ];

  return (
    <div className="flex flex-col gap-2.5 border-t border-linea pt-4">
      {preguntas.procesador && (
        <>
          <Titulo importante>¿Para qué procesador es?</Titulo>
          <Opciones
            etiqueta="¿Para qué procesador es?"
            opciones={PROCESADORES}
            valor={variantes.perfil_memoria}
            alCambiar={(perfil_memoria) => cambiar({ perfil_memoria })}
          />
          {delCatalogo && variantes.perfil_memoria === delCatalogo && (
            <span className="-mt-1 text-[12px] text-[#59645e]">
              ✦ Ya viene marcado: el catálogo dice que esta memoria {DICE_EL_CATALOGO[delCatalogo]}.
              Puedes cambiarlo.
            </span>
          )}
          <span className="rounded-[10px] bg-[#FFF4E5] px-2.5 py-2 text-[12.5px] leading-[1.45] text-[#8A4B00]">
            Las tiendas buscan «RAM para Ryzen». Si lo marcas, tu memoria sale en esa búsqueda y se
            ve en el título.
          </span>
        </>
      )}
      {preguntas.oc && (
        <>
          <Titulo>OC o normal</Titulo>
          <Opciones
            etiqueta="OC o normal"
            opciones={[
              [true, 'OC'],
              [false, 'Normal'],
            ]}
            valor={variantes.oc}
            alCambiar={(oc) => cambiar({ oc })}
          />
        </>
      )}
      {preguntas.empaque && (
        <>
          <Titulo>Empaque</Titulo>
          <Opciones
            etiqueta="Empaque"
            opciones={empaques}
            valor={variantes.empaque}
            alCambiar={(empaque) => cambiar({ empaque })}
          />
        </>
      )}
      <span className="rounded-[10px] bg-superficie px-2.5 py-2 text-[12.5px]">
        Título: {titulo}
        <PastillasTitulo variantes={variantes} titulo={titulo} />
      </span>
    </div>
  );
}
