import {
  formatearPrecio,
  type PrecioDeModelo,
  type RespuestaPreciosCategoria,
  type RitmoModelo,
} from '@paselibre/contracts';
import {
  IconAdjustmentsHorizontal,
  IconArrowDown,
  IconArrowUp,
  IconMinus,
} from '@tabler/icons-react';
import Link from 'next/link';

import { conPlural } from '@/shared/plural';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';

import { FiltrosPrecios } from './filtros-precios';

const ORDENES: Array<['vendidos' | 'baratos' | 'bajaron', string, string]> = [
  ['vendidos', 'Más vendidos', 'Más vendidos'],
  ['baratos', 'Más baratos', 'Más baratos'],
  ['bajaron', 'Bajaron de precio', 'Bajaron'],
];

const RITMO: Record<RitmoModelo, [string, string]> = {
  RAPIDO: ['Se vende rápido', 'bg-pase-suave text-pase-texto'],
  NORMAL: ['Normal', 'bg-superficie text-secundario'],
  LENTO: ['Se mueve lento', 'bg-aviso-fondo text-aviso'],
};

/** La línea de 30 días: el más bajo de cada día, con un punto en el de hoy. */
function Linea({ serie }: { serie: number[] }) {
  const ancho = 128;
  const alto = 30;
  if (serie.length === 0) return <span className="text-nota text-detalle">—</span>;
  const menor = Math.min(...serie);
  const mayor = Math.max(...serie);
  const rango = mayor - menor || 1;
  const puntos = serie.map((valor, i) => [
    serie.length === 1 ? ancho - 4 : 2 + (i * (ancho - 6)) / (serie.length - 1),
    serie.length === 1 || mayor === menor ? alto / 2 : 3 + ((mayor - valor) / rango) * (alto - 6),
  ]);
  const ultimo = puntos[puntos.length - 1] ?? [0, 0];
  return (
    <svg
      width={ancho}
      height={alto}
      viewBox={`0 0 ${ancho} ${alto}`}
      role="img"
      aria-label={
        serie.length === 1 ? 'Solo hay el precio de hoy' : `Precio de ${serie.length} días`
      }
      className="text-pase"
    >
      {puntos.length > 1 && (
        <polyline
          points={puntos.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={ultimo[0]} cy={ultimo[1]} r="3" fill="currentColor" />
    </svg>
  );
}

function Cambio({ cambio }: { cambio: number | null }) {
  if (cambio === null) return <span className="text-apoyo text-detalle">Sin historia</span>;
  if (Math.abs(cambio) < 1) {
    return (
      <span className="flex items-center gap-1 text-apoyo font-bold">
        <IconMinus size={14} stroke={2.2} aria-hidden="true" />
        Estable
      </span>
    );
  }
  const bajo = cambio < 0;
  return (
    <span className="flex items-center gap-1 text-apoyo font-bold">
      {bajo ? (
        <IconArrowDown size={14} stroke={2.2} aria-hidden="true" />
      ) : (
        <IconArrowUp size={14} stroke={2.2} aria-hidden="true" />
      )}
      {bajo ? 'Bajó' : 'Subió'} {Math.abs(cambio)}%
    </span>
  );
}

function Ritmo({ ritmo }: { ritmo: RitmoModelo }) {
  const [texto, clase] = RITMO[ritmo];
  return (
    <span
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-nota font-bold ${clase}`}
    >
      {texto}
    </span>
  );
}

const precio = (modelo: PrecioDeModelo, campo: 'desde' | 'promedio') => {
  const valor = modelo[campo];
  return valor ? formatearPrecio(valor) : '—';
};

/**
 * La página de una categoría (CAT_Web4, CAT_Cel4, sección 8 del lienzo final): cuánto se está
 * pasando cada modelo hoy en Wilson. Solo con sesión: los clientes nunca la ven.
 */
export function PaginaCategoria({
  datos,
  orden,
  consulta,
}: {
  datos: RespuestaPreciosCategoria;
  orden: 'vendidos' | 'baratos' | 'bajaron';
  /** Los filtros de la dirección, para que el orden no los borre. */
  consulta: string;
}) {
  const { resumen } = datos;
  const enlaceOrden = (clave: string) => {
    const parametros = new URLSearchParams(consulta);
    if (clave === 'vendidos') parametros.delete('orden');
    else parametros.set('orden', clave);
    const texto = parametros.toString();
    return `/categorias/${datos.categoria.slug}${texto ? `?${texto}` : ''}`;
  };
  const chip = (activo: boolean) =>
    `flex h-10 shrink-0 items-center rounded-full border px-4 text-apoyo no-underline ${
      activo
        ? 'border-tinta bg-tinta font-bold text-white'
        : 'border-borde bg-white font-bold text-tinta'
    }`;

  return (
    <div className="flex flex-col gap-5">
      <CabeceraMovil
        centro={
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <b className="truncate text-[20px] font-bold leading-6">{datos.categoria.nombre}</b>
            <span className="truncate text-nota text-white/85">
              {conPlural(resumen.publicadas, 'publicada', 'publicadas')} ·{' '}
              {conPlural(resumen.tiendas, 'tienda', 'tiendas')}
            </span>
          </span>
        }
      />
      <div className="flex flex-col gap-1 max-md:hidden">
        <nav aria-label="Ruta" className="flex gap-2 text-nota text-detalle">
          <Link href="/" className="text-secundario">
            Inicio
          </Link>
          <span aria-hidden="true">›</span>
          <span>{datos.categoria.nombre}</span>
        </nav>
        <h1 className="text-titulo">{datos.categoria.nombre}</h1>
        <p className="m-0 text-cuerpo text-secundario">
          Cuánto se está pasando cada modelo hoy en Wilson, para que compres y vendas al precio
          justo.
        </p>
      </div>

      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        <li className="flex flex-col gap-1 rounded-[20px] border border-linea bg-white p-4">
          <b className="text-[28px] font-bold leading-9">{resumen.publicadas}</b>
          <span className="text-apoyo text-secundario">publicadas ahora</span>
        </li>
        <li className="flex flex-col gap-1 rounded-[20px] border border-linea bg-white p-4">
          <b className="text-[28px] font-bold leading-9">{resumen.tiendas}</b>
          <span className="text-apoyo text-secundario">tiendas con stock</span>
        </li>
        <li className="flex flex-col gap-1 rounded-[20px] border border-linea bg-white p-4 max-lg:hidden">
          <b className="text-[28px] font-bold leading-9">{resumen.en_vivo_hoy}</b>
          <span className="text-apoyo text-secundario">pedidos en vivo hoy</span>
          <Link href="/pedidos-en-vivo" className="text-apoyo font-bold text-pase-texto">
            Verlos ›
          </Link>
        </li>
        <li className="flex flex-col gap-1 rounded-[20px] border border-linea bg-white p-4 max-lg:hidden">
          <b className="text-[28px] font-bold leading-9">
            {resumen.mas_bajo ? formatearPrecio(resumen.mas_bajo.precio) : '—'}
          </b>
          <span className="text-apoyo text-secundario">
            {resumen.mas_bajo
              ? `el pase más bajo hoy (${resumen.mas_bajo.titulo})`
              : 'aún sin precios a la vista'}
          </span>
        </li>
      </ul>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden rounded-[20px] border border-linea bg-white p-5 lg:block">
          <FiltrosPrecios filtros={datos.filtros} />
        </aside>

        <section
          aria-labelledby="por-modelo"
          className="flex min-w-0 flex-col gap-3 lg:rounded-[20px] lg:border lg:border-linea lg:bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 lg:px-5 lg:pt-5">
            <div className="flex flex-col max-lg:hidden">
              <h2 id="por-modelo" className="text-[18px] font-bold">
                Precios de pase por modelo
              </h2>
              <span className="text-apoyo text-secundario">
                El más bajo de hoy, el promedio y cómo se movió en 30 días
              </span>
            </div>
            <nav
              aria-label="Orden"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0"
            >
              {ORDENES.map(([clave, largo, corto]) => (
                <Link
                  key={clave}
                  href={enlaceOrden(clave)}
                  scroll={false}
                  aria-current={orden === clave ? 'true' : undefined}
                  className={chip(orden === clave)}
                >
                  <span className="max-sm:hidden">{largo}</span>
                  <span className="sm:hidden">{corto}</span>
                </Link>
              ))}
              <details className="lg:hidden">
                <summary className={`${chip(false)} cursor-pointer list-none gap-1.5`}>
                  <IconAdjustmentsHorizontal size={16} stroke={1.8} aria-hidden="true" />
                  Filtros
                </summary>
                <div className="fixed inset-x-4 top-24 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-linea bg-white p-5 shadow-[0_12px_28px_rgba(20,22,26,0.2)]">
                  <FiltrosPrecios filtros={datos.filtros} />
                </div>
              </details>
            </nav>
          </div>

          {datos.modelos.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-secundario">
              Nada publicado con estos filtros.
            </p>
          ) : (
            <>
              <table className="w-full border-collapse text-left max-lg:hidden">
                <thead>
                  <tr className="border-b border-linea text-etiqueta uppercase text-detalle">
                    <th scope="col" className="px-3 py-3 pl-5 font-bold">
                      Modelo
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">
                      Desde
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">
                      Promedio
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      30 días
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Cambio
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">
                      Tiendas
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Ritmo
                    </th>
                    <th scope="col" className="px-3 py-3 pr-5">
                      <span className="sr-only">Ver</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.modelos.map((modelo) => (
                    <tr key={modelo.slug} className="border-b border-linea last:border-0">
                      <td className="max-w-[260px] px-3 py-3 pl-5">
                        <Link
                          href={`/p/${modelo.slug}`}
                          className="line-clamp-2 text-cuerpo font-bold text-tinta no-underline hover:underline"
                        >
                          {modelo.titulo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-cuerpo font-bold tabular-nums">
                        {precio(modelo, 'desde')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-apoyo tabular-nums text-secundario">
                        {precio(modelo, 'promedio')}
                      </td>
                      <td className="px-3 py-3">
                        <Linea serie={modelo.serie} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Cambio cambio={modelo.cambio} />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{modelo.tiendas}</td>
                      <td className="px-3 py-3">
                        <Ritmo ritmo={modelo.ritmo} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 pr-5 text-right">
                        <Link href={`/p/${modelo.slug}`} className="font-bold text-pase-texto">
                          Ver {modelo.ofertas} ›
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:hidden">
                {datos.modelos.map((modelo) => (
                  <li key={modelo.slug}>
                    <Link
                      href={`/p/${modelo.slug}`}
                      className="flex flex-col gap-2 rounded-2xl border border-linea bg-white p-4 text-tinta no-underline"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <b className="min-w-0 text-cuerpo font-bold">{modelo.titulo}</b>
                        <Ritmo ritmo={modelo.ritmo} />
                      </span>
                      <span className="flex items-end justify-between gap-3">
                        <span className="flex flex-col">
                          <span className="text-nota text-secundario">Desde</span>
                          <b className="text-[22px] font-bold leading-7">
                            {precio(modelo, 'desde')}
                          </b>
                          <span className="text-nota text-secundario">
                            Promedio {precio(modelo, 'promedio')} · {modelo.tiendas}{' '}
                            {modelo.tiendas === 1 ? 'tienda' : 'tiendas'}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <Linea serie={modelo.serie} />
                          <Cambio cambio={modelo.cambio} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="m-0 text-nota text-secundario lg:border-t lg:border-linea lg:px-5 lg:py-3">
            Precios de pase entre tiendas de Wilson, puestos al día cada vez que alguien abre esta
            página. Los clientes nunca la ven.
          </p>
        </section>
      </div>
    </div>
  );
}
