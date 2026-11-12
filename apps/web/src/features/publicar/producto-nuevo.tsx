'use client';

import type { ArchivoSubido, CategoriaResumen } from '@paselibre/contracts';
import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { campo, etiqueta } from '@/shared/ui/estilos';

import { SelectorFotos } from './selector-fotos';

export interface DatosProductoNuevo {
  categoria: string;
  marca: string;
  modelo: string;
  /** «OC», «Normal», «Ti» (opcional): va en el título. */
  version: string;
  /** El código del fabricante (opcional): si ya está en el catálogo, se publica uno igual. */
  codigo_parte: string;
  etiquetas: string[];
}

export const PRODUCTO_NUEVO_VACIO: DatosProductoNuevo = {
  categoria: '',
  marca: '',
  modelo: '',
  version: '',
  codigo_parte: '',
  etiquetas: [],
};

/** Las cuatro que más se publican van como botones; el resto, en «Más ▾». */
const PRIMERAS = ['graficas', 'procesadores', 'ram', 'almacenamiento'];

/**
 * «Producto y fotos» de la publicación a mano (COR9): la categoría con botones, marca, modelo,
 * versión y código de parte (opcionales) y las fotos (opcionales). El título se arma con la
 * marca, el modelo y la versión.
 */
export function ProductoNuevo({
  datos,
  alCambiar,
  fotos,
  alCambiarFotos,
  alCargarFotos,
}: {
  datos: DatosProductoNuevo;
  alCambiar: (datos: DatosProductoNuevo) => void;
  fotos: ArchivoSubido[];
  alCambiarFotos: Dispatch<SetStateAction<ArchivoSubido[]>>;
  alCargarFotos: (cargando: boolean) => void;
}) {
  const id = useId();
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);

  useEffect(() => {
    void llamarApi<CategoriaResumen[]>('/categorias').then(setCategorias, () => setCategorias([]));
  }, []);

  const primeras = PRIMERAS.map((slug) => categorias.find((c) => c.slug === slug)).filter(
    (c): c is CategoriaResumen => Boolean(c),
  );
  const resto = categorias.filter((c) => !PRIMERAS.includes(c.slug));
  const enResto = resto.some((c) => c.slug === datos.categoria);
  const chip = (activa: boolean) =>
    `h-10 rounded-full border px-4 text-apoyo ${
      activa ? 'border-tinta bg-tinta font-bold text-white' : 'border-borde bg-white font-medium'
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id={`${id}-categoria`} className="text-apoyo font-bold">
          Categoría
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-categoria`} className="flex flex-wrap gap-2">
          {primeras.map((c) => (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={datos.categoria === c.slug}
              onClick={() => alCambiar({ ...datos, categoria: c.slug })}
              className={chip(datos.categoria === c.slug)}
            >
              {c.nombre}
            </button>
          ))}
          <select
            aria-label="Más categorías"
            value={enResto ? datos.categoria : ''}
            onChange={(evento) =>
              evento.target.value && alCambiar({ ...datos, categoria: evento.target.value })
            }
            className={`${chip(enResto)} appearance-none pr-4`}
          >
            <option value="">Más ▾</option>
            {resto.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <label htmlFor={`${id}-marca`} className={etiqueta}>
          <span className="font-bold">Marca</span>
          <input
            id={`${id}-marca`}
            required
            maxLength={60}
            value={datos.marca}
            onChange={(evento) => alCambiar({ ...datos, marca: evento.target.value })}
            placeholder="Ej. ASUS"
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-modelo`} className={etiqueta}>
          <span className="font-bold">Modelo</span>
          <input
            id={`${id}-modelo`}
            required
            maxLength={120}
            value={datos.modelo}
            onChange={(evento) => alCambiar({ ...datos, modelo: evento.target.value })}
            placeholder="Ej. TUF Gaming RTX 5070"
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-version`} className={etiqueta}>
          <span>
            <span className="font-bold">Versión</span>{' '}
            <span className="font-normal text-secundario">(opcional)</span>
          </span>
          <input
            id={`${id}-version`}
            maxLength={40}
            value={datos.version}
            onChange={(evento) => alCambiar({ ...datos, version: evento.target.value })}
            placeholder="Ej. OC"
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-codigo`} className={etiqueta}>
          <span>
            <span className="font-bold">Código de parte</span>{' '}
            <span className="font-normal text-secundario">(opcional)</span>
          </span>
          <input
            id={`${id}-codigo`}
            maxLength={60}
            autoCapitalize="characters"
            spellCheck={false}
            value={datos.codigo_parte}
            onChange={(evento) => alCambiar({ ...datos, codigo_parte: evento.target.value })}
            placeholder="Ej. TUF-RTX5070-O12G"
            className={campo}
          />
        </label>
      </div>
      <SelectorFotos
        variante="mosaico"
        titulo="Fotos del producto (opcional)"
        ayuda="JPG, PNG o fotos de iPhone · la primera queda como la del catálogo."
        fotos={fotos}
        alCambiar={alCambiarFotos}
        alCargar={alCargarFotos}
      />
    </div>
  );
}
