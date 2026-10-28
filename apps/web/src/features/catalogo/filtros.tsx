import type { Faceta } from '@paselibre/contracts';
import Link from 'next/link';

import { campo } from '@/shared/ui/estilos';

import {
  alternar,
  con,
  hrefBuscar,
  textoConsulta,
  type Filtros,
  type GrupoFiltro,
} from './consulta';

function Opcion({
  href,
  activa,
  texto,
  cantidad,
}: {
  href: string;
  activa: boolean;
  texto: string;
  cantidad: number;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? 'true' : undefined}
      className="flex min-h-9 items-center gap-2.5 text-apoyo text-tinta no-underline"
    >
      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border ${
          activa ? 'border-pase bg-pase text-white' : 'border-borde-control bg-white'
        }`}
      >
        {activa && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">{texto}</span>
      <span className="text-nota text-detalle">{cantidad}</span>
      <span className="sr-only">{activa ? ', elegido' : ''}</span>
    </Link>
  );
}

function Grupo({
  titulo,
  grupo,
  opciones,
  filtros,
}: {
  titulo: string;
  grupo: GrupoFiltro;
  opciones: Faceta[];
  filtros: Filtros;
}) {
  if (opciones.length === 0) return null;
  return (
    <fieldset className="flex flex-col border-0 p-0">
      <legend className="mb-1 p-0 text-etiqueta uppercase text-detalle">{titulo}</legend>
      {opciones.map((opcion) => (
        <Opcion
          key={opcion.slug}
          href={hrefBuscar(alternar(filtros, grupo, opcion.slug))}
          activa={filtros[grupo].includes(opcion.slug)}
          texto={opcion.nombre}
          cantidad={opcion.cantidad}
        />
      ))}
    </fieldset>
  );
}

/**
 * Los filtros de la izquierda (F_Resultados). Cada opción es un enlace que prende o apaga
 * ese filtro, así la búsqueda se puede compartir y funciona sin JavaScript. El filtro de
 * precio solo existe con sesión: a un visitante la API se lo ignoraría.
 */
export function Filtrar({
  filtros,
  facetas,
  conSesion,
}: {
  filtros: Filtros;
  facetas: { galerias: Faceta[]; marcas: Faceta[]; condiciones: Faceta[]; con_stock: number };
  conSesion: boolean;
}) {
  const sinPrecio = con(filtros, { precioMin: '', precioMax: '' });
  const ocultos = [...new URLSearchParams(textoConsulta(sinPrecio))].filter(
    ([clave]) => clave !== 'moneda',
  );

  return (
    <aside aria-label="Filtros" className="flex flex-col gap-6">
      <Grupo titulo="Galería" grupo="galeria" opciones={facetas.galerias} filtros={filtros} />
      <Grupo titulo="Marca" grupo="marca" opciones={facetas.marcas} filtros={filtros} />
      <Grupo titulo="Estado" grupo="condicion" opciones={facetas.condiciones} filtros={filtros} />
      <fieldset className="flex flex-col border-0 p-0">
        <legend className="mb-1 p-0 text-etiqueta uppercase text-detalle">Disponibilidad</legend>
        <Opcion
          href={hrefBuscar(con(filtros, { stock: !filtros.stock }))}
          activa={filtros.stock}
          texto="Solo con stock"
          cantidad={facetas.con_stock}
        />
      </fieldset>
      {conSesion ? (
        <form action="/buscar" className="flex flex-col gap-2">
          {ocultos.map(([clave, valor]) => (
            <input key={clave} type="hidden" name={clave} value={valor} />
          ))}
          <span className="text-etiqueta uppercase text-detalle">Precio</span>
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-nota text-secundario">
              Desde
              <input
                name="precio_min"
                type="text"
                inputMode="numeric"
                placeholder="0"
                defaultValue={filtros.precioMin}
                className={`${campo} h-10`}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-nota text-secundario">
              Hasta
              <input
                name="precio_max"
                type="text"
                inputMode="numeric"
                placeholder="Sin límite"
                defaultValue={filtros.precioMax}
                className={`${campo} h-10`}
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="moneda-filtro">
              Moneda
            </label>
            <select
              id="moneda-filtro"
              name="moneda"
              defaultValue={filtros.moneda}
              className="h-10 rounded-xl border border-borde-control bg-white px-3 text-apoyo font-medium"
            >
              <option value="USD">US$</option>
              <option value="PEN">S/</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-full border border-borde px-4 text-apoyo font-medium"
            >
              Aplicar
            </button>
          </div>
          <span className="text-nota text-detalle">
            Las ofertas «Al interno» siempre se muestran.
          </span>
        </form>
      ) : (
        <p className="text-nota text-detalle">
          El filtro por precio aparece al{' '}
          <Link href="/ingresar" className="font-medium">
            iniciar sesión
          </Link>
          .
        </p>
      )}
    </aside>
  );
}
