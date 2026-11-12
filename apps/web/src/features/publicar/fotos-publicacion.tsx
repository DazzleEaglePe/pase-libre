'use client';

import type { ArchivoSubido } from '@paselibre/contracts';
import { useId, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';

import { TIPOS_FOTO, useSubirFotos } from './selector-fotos';

const FOCO =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta';

/** La portada que se manda a la API: una de las fotos de la tienda, o nula (la de siempre). */
export function portadaElegida(portada: string | null, fotos: ArchivoSubido[]): string | null {
  return portada !== null && fotos.some((foto) => foto.ruta === portada) ? portada : null;
}

/**
 * La portada que se ve (docs/17 §5): la elegida; si no hay, la del catálogo y, sin catálogo, la
 * primera de la tienda. Es la misma regla de la API, para la vista previa.
 */
export function portadaQueSeVe(
  portada: string | null,
  catalogo: string | null,
  fotos: ArchivoSubido[],
): string | null {
  return portadaElegida(portada, fotos) ?? catalogo ?? fotos[0]?.ruta ?? null;
}

/**
 * «Fotos de tu publicación» (docs/17 §5): la foto del catálogo y las de la tienda juntas, y la
 * que se toca queda de portada («★ Portada», borde verde). `portada` nula es la de siempre: la del
 * catálogo o, si el producto no tiene, la primera de la tienda. Quitar la foto que era portada
 * vuelve a la de siempre, igual que en la API.
 */
export function FotosPublicacion({
  catalogo,
  categoria,
  fotos,
  alCambiar,
  alCargar,
  portada,
  alElegirPortada,
}: {
  /** La foto principal del producto (en la publicación a mano, la primera que se subió). */
  catalogo: string | null;
  /** Para el dibujo de la categoría mientras una foto no carga. */
  categoria: string;
  /** Las fotos de la tienda (`fotos` de la oferta). */
  fotos: ArchivoSubido[];
  alCambiar: Dispatch<SetStateAction<ArchivoSubido[]>>;
  /** Avisa si hay fotos subiendo, para no publicar a medias. */
  alCargar: (cargando: boolean) => void;
  portada: string | null;
  alElegirPortada: (portada: string | null) => void;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const { subiendo, errores, libres, agregar } = useSubirFotos({ fotos, alCambiar, alCargar });
  const elegida = portadaQueSeVe(portada, catalogo, fotos);

  function quitar(ruta: string) {
    alCambiar((anteriores) => anteriores.filter((foto) => foto.ruta !== ruta));
    if (ruta === portada) alElegirPortada(null);
  }

  const arrastre = {
    onDragOver: (evento: DragEvent) => {
      evento.preventDefault();
      setEncima(true);
    },
    onDragLeave: () => setEncima(false),
    onDrop: (evento: DragEvent) => {
      evento.preventDefault();
      setEncima(false);
      void agregar(evento.dataTransfer.files);
    },
  };

  const opciones: Array<{ ruta: string; tuya: boolean; nombre: string }> = [
    ...(catalogo ? [{ ruta: catalogo, tuya: false, nombre: 'la foto del catálogo' }] : []),
    ...fotos.map((foto, indice) => ({
      ruta: foto.ruta,
      tuya: true,
      nombre: `tu foto ${indice + 1}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={entrada}
        id={`${id}-archivo`}
        type="file"
        accept={TIPOS_FOTO.join(',')}
        multiple
        hidden
        aria-label="Agregar tus fotos"
        onChange={(evento) => {
          void agregar(evento.target.files);
          evento.target.value = '';
        }}
      />
      <ul {...arrastre} className="m-0 flex list-none flex-wrap gap-3 p-0">
        {opciones.map(({ ruta, tuya, nombre }) => {
          const esPortada = ruta === elegida;
          return (
            <li key={ruta} className="relative">
              <button
                type="button"
                aria-pressed={esPortada}
                aria-label={`Usar ${nombre} de portada`}
                onClick={() => alElegirPortada(tuya ? ruta : null)}
                className={`relative block overflow-hidden rounded-xl border-2 ${
                  esPortada ? 'border-pase' : 'border-linea hover:border-borde-control'
                } ${FOCO}`}
              >
                <Miniatura
                  ruta={ruta}
                  categoria={categoria}
                  className="h-[104px] w-[104px]"
                  glifo={56}
                />
                {esPortada && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-pase px-2 text-[12px] font-bold leading-5 text-white">
                    ★ Portada
                  </span>
                )}
                <span className="absolute bottom-1.5 left-1.5 rounded-full border border-linea bg-white px-2 text-[12px] font-semibold leading-5 text-secundario">
                  {tuya ? 'Tuya' : 'Del catálogo'}
                </span>
              </button>
              {tuya && (
                <button
                  type="button"
                  aria-label={`Quitar ${nombre}`}
                  onClick={() => quitar(ruta)}
                  className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[17px] leading-none shadow-sm ${FOCO}`}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
        {Array.from({ length: subiendo }, (_, indice) => (
          <li
            key={`subiendo-${indice}`}
            className="flex h-[108px] w-[108px] items-center justify-center rounded-xl bg-superficie text-nota text-detalle"
          >
            Subiendo…
          </li>
        ))}
        {libres > 0 && (
          <li>
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className={`flex h-[108px] w-[108px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-2 text-center text-nota font-bold ${
                encima ? 'border-tinta bg-pase-suave' : 'border-borde-control bg-white'
              } ${FOCO}`}
            >
              <span aria-hidden="true" className="text-[22px] font-normal leading-6">
                +
              </span>
              Agregar tus fotos
            </button>
          </li>
        )}
      </ul>

      {errores.length > 0 && (
        <ul role="alert" className="m-0 flex list-none flex-col gap-0.5 p-0 text-nota text-error">
          {errores.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <p className="m-0 text-nota text-secundario">
        Una foto con fondo claro y el producto completo se ve mejor en el inicio.
      </p>
    </div>
  );
}
