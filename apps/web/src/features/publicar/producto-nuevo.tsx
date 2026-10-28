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
  etiquetas: string[];
}

export const PRODUCTO_NUEVO_VACIO: DatosProductoNuevo = {
  categoria: '',
  marca: '',
  modelo: '',
  etiquetas: [],
};

const MAX_ETIQUETAS = 12;

/** Etiquetas como píldoras: Enter o coma agregan; borrar con el campo vacío quita la última. */
function CampoEtiquetas({
  etiquetas,
  alCambiar,
}: {
  etiquetas: string[];
  alCambiar: (etiquetas: string[]) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');

  /** Agrega una o varias («ATX, Vidrio templado», también pegadas de una vez). */
  function agregar(valor: string) {
    const nuevas = [...etiquetas];
    for (const parte of valor.split(',')) {
      const limpia = parte.trim().slice(0, 40);
      const repetida = nuevas.some((e) => e.toLowerCase() === limpia.toLowerCase());
      if (limpia && !repetida && nuevas.length < MAX_ETIQUETAS) nuevas.push(limpia);
    }
    if (nuevas.length !== etiquetas.length) alCambiar(nuevas);
    setTexto('');
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={`${id}-etiqueta`} className="text-apoyo font-medium">
        Etiquetas
      </label>
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl border border-borde px-2 py-1.5">
        {etiquetas.map((e) => (
          <span
            key={e}
            className="flex h-[30px] items-center gap-1 rounded-full bg-superficie pl-2.5 pr-1.5 text-nota"
          >
            {e}
            <button
              type="button"
              aria-label={`Quitar ${e}`}
              onClick={() => alCambiar(etiquetas.filter((otra) => otra !== e))}
              className="h-[22px] w-[22px] text-cuerpo text-secundario"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={`${id}-etiqueta`}
          value={texto}
          onChange={(evento) => {
            const valor = evento.target.value;
            if (!valor.includes(',')) {
              setTexto(valor);
              return;
            }
            // Lo que va antes de la última coma son etiquetas; lo de después se sigue escribiendo.
            const corte = valor.lastIndexOf(',');
            agregar(valor.slice(0, corte));
            setTexto(valor.slice(corte + 1).trimStart());
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') {
              evento.preventDefault();
              agregar(texto);
            }
            if (evento.key === 'Backspace' && texto === '' && etiquetas.length > 0) {
              alCambiar(etiquetas.slice(0, -1));
            }
          }}
          onBlur={() => agregar(texto)}
          placeholder={etiquetas.length < MAX_ETIQUETAS ? 'Agregar etiqueta' : ''}
          disabled={etiquetas.length >= MAX_ETIQUETAS}
          className="h-8 min-w-0 flex-[1_1_120px] px-1.5 text-apoyo placeholder:text-detalle focus-visible:outline-none"
        />
      </div>
      <span className="text-nota text-detalle">
        Marca, serie, capacidad… ayudan a que te encuentren. Separa con Enter o coma.
      </span>
    </div>
  );
}

/**
 * Paso 1 cuando el producto no está en PaseLibre (RF-05): categoría, marca, modelo,
 * etiquetas y fotos base. El título se arma con la marca y el modelo.
 */
export function ProductoNuevo({
  datos,
  alCambiar,
  fotos,
  alCambiarFotos,
  alCargarFotos,
  alVolver,
}: {
  datos: DatosProductoNuevo;
  alCambiar: (datos: DatosProductoNuevo) => void;
  fotos: ArchivoSubido[];
  alCambiarFotos: Dispatch<SetStateAction<ArchivoSubido[]>>;
  alCargarFotos: (cargando: boolean) => void;
  alVolver: () => void;
}) {
  const id = useId();
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);

  useEffect(() => {
    void llamarApi<CategoriaResumen[]>('/categorias').then(setCategorias, () => setCategorias([]));
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-categoria`} className={etiqueta}>
        Categoría
        <select
          id={`${id}-categoria`}
          required
          value={datos.categoria}
          onChange={(evento) => alCambiar({ ...datos, categoria: evento.target.value })}
          className={campo}
        >
          <option value="">Elige la categoría</option>
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-marca`} className={etiqueta}>
        Marca
        <input
          id={`${id}-marca`}
          required
          maxLength={60}
          value={datos.marca}
          onChange={(evento) => alCambiar({ ...datos, marca: evento.target.value })}
          placeholder="Por ejemplo, Zotac"
          className={campo}
        />
      </label>
      <label htmlFor={`${id}-modelo`} className={`${etiqueta} sm:col-span-2`}>
        Modelo
        <input
          id={`${id}-modelo`}
          required
          maxLength={120}
          value={datos.modelo}
          onChange={(evento) => alCambiar({ ...datos, modelo: evento.target.value })}
          placeholder="Por ejemplo, Gaming GeForce RTX 3070 AMP Holo 8 GB"
          className={campo}
        />
      </label>
      <CampoEtiquetas
        etiquetas={datos.etiquetas}
        alCambiar={(etiquetas) => alCambiar({ ...datos, etiquetas })}
      />
      <div className="sm:col-span-2">
        <SelectorFotos
          variante="zona"
          titulo="Fotos del producto"
          ayuda="Hasta 8 · la primera es la portada"
          fotos={fotos}
          alCambiar={alCambiarFotos}
          alCargar={alCargarFotos}
        />
      </div>
      <button
        type="button"
        onClick={alVolver}
        className="h-9 justify-self-start text-apoyo font-medium underline"
      >
        Volver a buscar en el catálogo
      </button>
    </div>
  );
}
