'use client';

import type { Faceta } from '@paselibre/contracts';
import { IconAdjustmentsHorizontal, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Hoja } from '@/shared/ui/hoja';
import { Interruptor } from '@/shared/ui/interruptor';
import { campo } from '@/shared/ui/estilos';

import {
  alternar,
  con,
  cuantosFiltros,
  hayFiltros,
  hrefBuscar,
  sinFiltros,
  textoConsulta,
  type Filtros,
  type OrdenBusqueda,
} from './consulta';
import { Ordenar } from './ordenar';

const CHIP =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-apoyo no-underline';
const CHIP_NO = `${CHIP} border-borde bg-white font-medium text-tinta`;
const CHIP_SI = `${CHIP} border-tinta bg-tinta font-semibold text-white`;

/** Una opción que se prende o se apaga: un enlace, así la búsqueda se comparte y no pide JavaScript. */
function Atajo({ href, activo, children }: { href: string; activo: boolean; children: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? 'true' : undefined}
      className={activo ? CHIP_SI : CHIP_NO}
    >
      {children}
      <span className="sr-only">{activo ? ', elegido' : ''}</span>
    </Link>
  );
}

function Seccion({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col">
        <h3 className="text-tarjeta">{titulo}</h3>
        {nota && <span className="text-nota text-detalle">{nota}</span>}
      </div>
      {children}
    </section>
  );
}

function Fichas({
  opciones,
  elegidas,
  hrefDe,
}: {
  opciones: Faceta[];
  elegidas: string[];
  hrefDe: (slug: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((opcion) => {
        const activa = elegidas.includes(opcion.slug);
        return (
          <Link
            key={opcion.slug}
            href={hrefDe(opcion.slug)}
            scroll={false}
            aria-current={activa ? 'true' : undefined}
            className={`${CHIP} h-9 ${activa ? 'border-pase bg-pase-suave font-semibold text-tinta' : 'border-borde bg-white font-medium text-tinta'}`}
          >
            {opcion.nombre}
            <span className="font-medium text-detalle">{opcion.cantidad}</span>
            <span className="sr-only">{activa ? ', elegido' : ''}</span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * La fila de arriba de los resultados (K3): el botón «Filtros», tres atajos (con stock, nuevo,
 * usado), «Más filtros» y el orden. Todo lo demás vive en una hoja que se abre con el botón.
 * Cada opción es un enlace a la misma búsqueda con ese cambio; la hoja sigue abierta mientras
 * se eligen y los resultados de atrás se actualizan.
 */
export function BarraFiltros({
  filtros,
  facetas,
  conSesion,
  orden,
  totalOfertas,
}: {
  filtros: Filtros;
  facetas: { galerias: Faceta[]; marcas: Faceta[]; condiciones: Faceta[] };
  conSesion: boolean;
  /** El orden de verdad: el elegido o el que le toca a quien mira. */
  orden: OrdenBusqueda;
  totalOfertas: number;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const cuantos = cuantosFiltros(filtros);
  const hayQueLimpiar = hayFiltros(filtros) || !filtros.stock;

  const hrefOrden = (valor: OrdenBusqueda) => hrefBuscar(con(filtros, { orden: valor }));
  const ordenes: Array<[OrdenBusqueda, string]> = [
    ['precio_asc', 'Más barato primero'],
    ['precio_desc', 'Más caro primero'],
    ['recientes', 'Más recientes'],
  ];

  const sinPrecio = con(filtros, { precioMin: '', precioMax: '' });
  const ocultos = [...new URLSearchParams(textoConsulta(sinPrecio))].filter(
    ([clave]) => clave !== 'moneda',
  );
  const soloUnEstado = filtros.condicion.length === 1 ? filtros.condicion[0] : null;
  const cantidadDe = (slug: string) => facetas.condiciones.find((f) => f.slug === slug)?.cantidad;

  return (
    <>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-3.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-tinta bg-white pl-3.5 pr-4 text-apoyo font-semibold text-tinta"
        >
          <IconAdjustmentsHorizontal size={18} stroke={1.8} aria-hidden="true" />
          Filtros
          {cuantos > 0 && (
            <span className="min-w-5 rounded-full bg-pase px-1.5 text-center text-nota font-semibold leading-5 text-white">
              <span className="sr-only">, </span>
              {cuantos}
              <span className="sr-only"> puestos</span>
            </span>
          )}
        </button>
        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-borde" />
        <Atajo href={hrefBuscar(con(filtros, { stock: !filtros.stock }))} activo={filtros.stock}>
          Con stock
        </Atajo>
        <Atajo
          href={hrefBuscar(alternar(filtros, 'condicion', 'nuevo'))}
          activo={filtros.condicion.includes('nuevo')}
        >
          Nuevo
        </Atajo>
        <Atajo
          href={hrefBuscar(alternar(filtros, 'condicion', 'usado'))}
          activo={filtros.condicion.includes('usado')}
        >
          Usado
        </Atajo>
        {/* En Memoria RAM (docs/19 §13): las marcadas así o «Sirve para los dos» al publicar. */}
        {filtros.categoria === 'ram' &&
          (
            [
              ['intel', 'Para Intel'],
              ['ryzen', 'Para Ryzen'],
            ] as const
          ).map(([valor, texto]) => (
            <Atajo
              key={valor}
              href={hrefBuscar(con(filtros, { perfil: filtros.perfil === valor ? null : valor }))}
              activo={filtros.perfil === valor}
            >
              {texto}
            </Atajo>
          ))}
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-borde-control bg-white px-3.5 text-apoyo font-semibold text-tinta"
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Más filtros
        </button>
        {conSesion && (
          <div className="sm:ml-auto">
            <Ordenar
              actual={orden}
              opciones={ordenes.map(([valor, texto]) => ({ valor, texto, href: hrefOrden(valor) }))}
            />
          </div>
        )}
      </div>

      <Hoja
        titulo="Filtros"
        abierta={abierta}
        alCerrar={() => setAbierta(false)}
        pie={
          <>
            {hayQueLimpiar ? (
              <Link
                href={hrefBuscar(sinFiltros(filtros))}
                scroll={false}
                className="text-apoyo font-semibold underline"
              >
                Limpiar
              </Link>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setAbierta(false)}
              className="inline-flex h-11 items-center rounded-full bg-pase px-5 text-cuerpo font-semibold text-white"
            >
              {totalOfertas === 1 ? 'Ver 1 oferta' : `Ver ${totalOfertas} ofertas`}
            </button>
          </>
        }
      >
        {conSesion && (
          <Seccion titulo="Ordenar">
            <div
              role="group"
              aria-label="Ordenar"
              className="flex max-w-[420px] gap-1 rounded-full bg-superficie p-1"
            >
              {ordenes
                .filter(([valor]) => valor !== 'precio_desc' || orden === 'precio_desc')
                .map(([valor, texto]) => (
                  <Link
                    key={valor}
                    href={hrefOrden(valor)}
                    scroll={false}
                    aria-current={orden === valor ? 'true' : undefined}
                    className={`flex h-10 flex-1 items-center justify-center rounded-full px-2 text-center text-apoyo no-underline ${
                      orden === valor
                        ? 'bg-white font-semibold text-tinta shadow-[0_1px_2px_rgba(15,20,18,0.16)]'
                        : 'font-medium text-secundario'
                    }`}
                  >
                    {texto}
                  </Link>
                ))}
            </div>
          </Seccion>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-6">
          <div className="flex min-w-[260px] flex-1 items-center justify-between gap-3">
            <span className="flex flex-col">
              <b className="text-tarjeta">Solo con stock</b>
              <span className="text-nota text-detalle">Oculta lo que ya se agotó</span>
            </span>
            <Interruptor
              activo={filtros.stock}
              alCambiar={() =>
                router.push(hrefBuscar(con(filtros, { stock: !filtros.stock })), { scroll: false })
              }
              etiqueta="Solo con stock"
            />
          </div>
          <div className="flex min-w-[260px] flex-1 flex-col gap-2.5">
            <h3 className="text-tarjeta">Estado</h3>
            <div
              role="group"
              aria-label="Estado"
              className="flex gap-1 rounded-full bg-superficie p-1"
            >
              {(
                [
                  [null, 'Todos', undefined],
                  ['nuevo', 'Nuevo', cantidadDe('nuevo')],
                  ['usado', 'Usado', cantidadDe('usado')],
                ] as const
              ).map(([valor, texto, cantidad]) => {
                const activo = soloUnEstado === valor;
                return (
                  <Link
                    key={texto}
                    href={hrefBuscar(con(filtros, { condicion: valor ? [valor] : [] }))}
                    scroll={false}
                    aria-current={activo ? 'true' : undefined}
                    className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-apoyo no-underline ${
                      activo
                        ? 'bg-white font-semibold text-tinta shadow-[0_1px_2px_rgba(15,20,18,0.16)]'
                        : 'font-medium text-secundario'
                    }`}
                  >
                    {texto}
                    {cantidad !== undefined && <span className="text-detalle">{cantidad}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {facetas.galerias.length > 0 && (
          <Seccion titulo="Galería">
            <Fichas
              opciones={facetas.galerias}
              elegidas={filtros.galeria}
              hrefDe={(slug) => hrefBuscar(alternar(filtros, 'galeria', slug))}
            />
          </Seccion>
        )}

        {facetas.marcas.length > 0 && (
          <Seccion titulo="Marca">
            <Fichas
              opciones={facetas.marcas}
              elegidas={filtros.marca}
              hrefDe={(slug) => hrefBuscar(alternar(filtros, 'marca', slug))}
            />
          </Seccion>
        )}

        {conSesion ? (
          <Seccion titulo="Precio" nota="Las ofertas «Al interno» siempre se muestran.">
            <form action="/buscar" className="flex flex-wrap items-end gap-3">
              {ocultos.map(([clave, valor]) => (
                <input key={clave} type="hidden" name={clave} value={valor} />
              ))}
              <label className="flex w-28 flex-col gap-1 text-nota text-secundario">
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
              <label className="flex w-28 flex-col gap-1 text-nota text-secundario">
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
              <label className="flex flex-col gap-1 text-nota text-secundario">
                Moneda
                <select
                  name="moneda"
                  defaultValue={filtros.moneda}
                  className="h-10 rounded-xl border border-borde-control bg-white px-3 text-apoyo font-medium text-tinta"
                >
                  <option value="USD">US$</option>
                  <option value="PEN">S/</option>
                </select>
              </label>
              <button
                type="submit"
                className="h-10 rounded-full border border-borde px-4 text-apoyo font-semibold"
              >
                Aplicar
              </button>
            </form>
          </Seccion>
        ) : (
          <p className="text-nota text-detalle">
            El orden y el filtro por precio aparecen al{' '}
            <Link href="/ingresar" className="font-medium">
              iniciar sesión
            </Link>
            .
          </p>
        )}
      </Hoja>
    </>
  );
}
