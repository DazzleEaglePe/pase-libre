'use client';

import type {
  Condicion,
  ProductoResumen,
  RespuestaSugerencias,
  SugerenciaProducto,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { campo, etiqueta } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';

const CONDICION = { NUEVO: 'nuevo', USADO: 'usado' } as const;

/** «Gráficas · MSI · 8 GB · GDDR6»: categoría, marca y unas etiquetas que no repitan la marca. */
export function lineaDeProducto(producto: ProductoResumen): string {
  const marca = producto.marca?.toLowerCase();
  const etiquetas = producto.etiquetas.filter((e) => e.toLowerCase() !== marca).slice(0, 3);
  return [producto.categoria.nombre, producto.marca, ...etiquetas].filter(Boolean).join(' · ');
}

function textoPropias(propias: SugerenciaProducto['propias']): string | null {
  if (propias.length === 0) return null;
  return `Ya lo tienes como ${propias.map((p) => CONDICION[p.condicion]).join(' y ')}`;
}

/**
 * Paso 1 en modo búsqueda: «¿Qué vas a publicar?» y la lista «Ya está en PaseLibre»
 * (RF-53). Usa la misma búsqueda tolerante del catálogo, así «rtx 3370» también sugiere
 * la 3070 y se evitan productos repetidos.
 */
export function BuscadorProducto({
  q,
  alEscribir,
  alElegir,
  alCrearNuevo,
}: {
  q: string;
  alEscribir: (q: string) => void;
  alElegir: (producto: SugerenciaProducto) => void;
  alCrearNuevo: () => void;
}) {
  const id = useId();
  const [resultado, setResultado] = useState<RespuestaSugerencias | null>(null);
  const [buscado, setBuscado] = useState('');
  const ultima = useRef(0);
  const texto = q.trim();

  useEffect(() => {
    if (texto.length < 2) {
      setResultado(null);
      setBuscado('');
      return;
    }
    const numero = ++ultima.current;
    const espera = setTimeout(async () => {
      try {
        const respuesta = await llamarApi<RespuestaSugerencias>(
          `/catalogo/sugerencias?q=${encodeURIComponent(texto)}`,
        );
        // Solo la última búsqueda: las respuestas pueden llegar en otro orden.
        if (numero === ultima.current) {
          setResultado(respuesta);
          setBuscado(texto);
        }
      } catch {
        if (numero === ultima.current) setResultado(null);
      }
    }, 250);
    return () => clearTimeout(espera);
  }, [texto]);

  const productos = resultado?.productos ?? [];
  const sinResultados = buscado !== '' && productos.length === 0;

  return (
    <>
      <label htmlFor={`${id}-q`} className={etiqueta}>
        ¿Qué vas a publicar?
        <input
          id={`${id}-q`}
          type="search"
          autoComplete="off"
          value={q}
          onChange={(evento) => alEscribir(evento.target.value)}
          placeholder="Marca y modelo, por ejemplo «rtx 3070 ventus»"
          className={campo}
        />
      </label>

      {productos.length > 0 && (
        <div className="flex flex-col rounded-xl border border-linea">
          <span className="px-4 pb-1 pt-3 text-etiqueta uppercase text-detalle">
            Ya está en PaseLibre
          </span>
          {resultado?.correccion && (
            <span className="px-4 pb-1 text-nota text-secundario">
              Mostramos resultados para «{resultado.correccion.mostramos}».
            </span>
          )}
          <ul>
            {productos.map((producto) => {
              const propias = textoPropias(producto.propias);
              return (
                <li
                  key={producto.id}
                  className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border-b border-linea px-4 py-2.5 sm:grid-cols-[56px_minmax(0,1fr)_168px]"
                >
                  <Miniatura
                    ruta={producto.foto}
                    categoria={producto.categoria.slug}
                    className="h-[42px] w-14 rounded-lg"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{producto.titulo}</span>
                    <span className="text-nota text-detalle">
                      {producto.categoria.nombre} ·{' '}
                      {producto.ofertas === 1 ? '1 oferta' : `${producto.ofertas} ofertas`}
                      {propias && <span className="text-aviso"> · {propias}</span>}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => alElegir(producto)}
                    aria-label={`Publicar uno igual: ${producto.titulo}`}
                    className="col-span-2 h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-medium sm:col-span-1 sm:w-[168px]"
                  >
                    Publicar uno igual
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-apoyo text-secundario">¿No está en la lista?</span>
            <button
              type="button"
              onClick={alCrearNuevo}
              className="h-9 text-apoyo font-medium underline"
            >
              Crear producto nuevo
            </button>
          </div>
        </div>
      )}

      {sinResultados && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-linea px-4 py-3.5">
          <span className="text-apoyo text-secundario">
            No encontramos «{buscado}» en el catálogo.
          </span>
          <button
            type="button"
            onClick={alCrearNuevo}
            className="h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-medium"
          >
            Crear producto nuevo
          </button>
        </div>
      )}
    </>
  );
}

/** Paso 1 con el producto ya elegido: «Usas sus 4 fotos y sus datos del catálogo». */
export function ProductoElegido({
  producto,
  propias,
  condicion,
  alCambiar,
}: {
  producto: ProductoResumen;
  /** Solo al publicar: las ofertas que la tienda ya tiene de este producto. */
  propias?: SugerenciaProducto['propias'];
  condicion: Condicion;
  alCambiar?: () => void;
}) {
  const repetida = propias?.find((p) => p.condicion === condicion);
  return (
    <>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-xl border border-linea px-4 py-3.5 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
        <Miniatura
          ruta={producto.foto}
          categoria={producto.categoria.slug}
          className="h-[54px] w-[72px] rounded-[10px] sm:h-[72px] sm:w-24"
          glifo={72}
          grosor={2.5}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-tarjeta">{producto.titulo}</span>
          <span className="text-nota text-detalle">{lineaDeProducto(producto)}</span>
          <span className="text-nota text-ok">
            {producto.fotos === 0
              ? 'Usas sus datos del catálogo'
              : producto.fotos === 1
                ? 'Usas su foto y sus datos del catálogo'
                : `Usas sus ${producto.fotos} fotos y sus datos del catálogo`}
          </span>
        </span>
        {alCambiar && (
          <button
            type="button"
            onClick={alCambiar}
            className="col-span-2 h-9 justify-self-start text-apoyo font-medium underline sm:col-span-1"
          >
            Cambiar
          </button>
        )}
      </div>
      {repetida && (
        <p className="rounded-xl bg-aviso-fondo px-4 py-3 text-apoyo text-aviso">
          Tu tienda ya tiene este producto como {CONDICION[condicion]}
          {repetida.estado === 'PAUSADA' ? ', pausado' : ''}. Cambia el stock o el precio desde{' '}
          <Link href="/mis-publicaciones" className="font-medium text-aviso">
            Mis publicaciones
          </Link>
          , o elige el otro estado.
        </p>
      )}
    </>
  );
}
