'use client';

import {
  formatearPrecio,
  TEXTO_MODO_VENTA,
  type RespuestaHistorial,
  type VentaEnHistorial,
} from '@paselibre/contracts';
import { IconDownload, IconMessage, IconStar } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { TarjetaCalificar } from '@/features/tiendas/calificar';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { diaConSemana } from '@/shared/fechas';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Miniatura } from '@/shared/ui/miniatura';

type Lado = 'ventas' | 'compras';

const MES_LIMA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
});

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const faltan = (n: number) => (n === 1 ? 'Te falta 1' : `Te faltan ${n}`);

/** Papelitos del «¡Pica pica!» (HI_A2_CelPica). Fijos: no cambian en cada render. */
const PAPELITOS: Array<[number, number, string, number]> = [
  [12, 14, '#22D37A', 20],
  [26, 70, '#FFFFFF', -25],
  [40, 34, '#F97316', 40],
  [55, 82, '#EF4444', -10],
  [63, 20, '#3B82F6', 60],
  [72, 60, '#FDE047', 15],
  [84, 30, '#FFFFFF', -40],
  [90, 76, '#22D37A', 30],
  [18, 88, '#FDE047', -60],
  [47, 8, '#FFFFFF', 10],
];

/**
 * «Este mes vendiste 9 items» (HI_A2_Web, estilo A · emojis): 💪 hasta los 10, 🎉 «¡Pica pica!»
 * hasta los 20 y 🔥 desde ahí.
 */
function Logro({ n, mes, promedio }: { n: number; mes: string; promedio: number | null }) {
  const encabezado = `${mes} vendiste`;
  const numero = (
    <span className="flex items-baseline gap-2.5">
      <b className="text-[56px] font-bold leading-[60px]">{n}</b>
      <b className="text-[20px] font-bold">{n === 1 ? 'item' : 'items'}</b>
    </span>
  );

  if (n >= 20) {
    const arriba = promedio && n > promedio ? Math.round(((n - promedio) / promedio) * 100) : null;
    return (
      <section
        aria-label="Lo que vendiste este mes"
        className="relative flex flex-col gap-2 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#9A3412,#F97316)] p-5 text-white"
      >
        <span className="text-apoyo text-white/85">{encabezado}</span>
        {numero}
        <span aria-hidden="true" className="absolute right-5 top-5 text-[48px] leading-none">
          🔥
        </span>
        <b className="text-[20px] font-bold leading-7">¡Estás que ardes!</b>
        <span className="text-apoyo text-white/90">
          {arriba !== null
            ? `Este mes vas ${arriba} % por encima de tu promedio (${items(promedio ?? 0)} al mes).`
            : 'Pasaste los 20 items: las tiendas te buscan primero.'}
        </span>
      </section>
    );
  }

  if (n >= 10) {
    return (
      <section
        aria-label="Lo que vendiste este mes"
        className="relative flex flex-col gap-2 overflow-hidden rounded-[20px] bg-marca p-5 text-white"
      >
        {PAPELITOS.map(([x, y, color, giro]) => (
          <span
            key={`${x}-${y}`}
            aria-hidden="true"
            className="absolute h-3 w-2 rounded-[2px] opacity-90"
            style={{ left: `${x}%`, top: `${y}%`, background: color, rotate: `${giro}deg` }}
          />
        ))}
        <span className="relative text-apoyo text-white/85">{encabezado}</span>
        <span className="relative">{numero}</span>
        <span aria-hidden="true" className="absolute right-5 top-5 text-[48px] leading-none">
          🎉
        </span>
        <b className="relative text-[20px] font-bold leading-7">
          ¡Pica pica! Tus productos se están moviendo
        </b>
        <span className="relative text-apoyo text-white/90">
          Ya pasaste los 10 items: las tiendas confían en lo que vendes.
        </span>
        <span className="relative mt-1 h-2.5 rounded-full bg-white/25">
          <span
            className="block h-full rounded-full bg-white"
            style={{ width: `${Math.min(100, (n - 10) * 10)}%` }}
          />
        </span>
        <span className="relative text-nota">{faltan(20 - n)} para el 🔥</span>
      </section>
    );
  }

  return (
    <section
      aria-label="Lo que vendiste este mes"
      className="relative flex flex-col gap-2 rounded-[20px] border border-linea bg-white p-5"
    >
      <span className="text-apoyo text-secundario">{encabezado}</span>
      {numero}
      <span aria-hidden="true" className="absolute right-5 top-5 text-[48px] leading-none">
        💪
      </span>
      <b className="text-[18px] font-bold leading-6">
        {n === 0 ? 'Tu primera venta del mes está cerca' : '¡Lo estás haciendo genial!'}
      </b>
      <span className="text-apoyo text-secundario">
        {n === 0
          ? 'Cuando marcas «Vendido» en el chat, sale aquí.'
          : 'Las tiendas están comprando tus productos.'}{' '}
        {faltan(10 - n)} para tu primer 🎉
      </span>
      <span className="mt-1 h-2.5 rounded-full bg-superficie">
        <span className="block h-full rounded-full bg-pase" style={{ width: `${n * 10}%` }} />
      </span>
      <span className="text-nota text-secundario">a los 10 items cae pica pica</span>
    </section>
  );
}

/** «Lo que más vendiste · Gráficas · 3 items», con sus barras. */
function PorCategoria({ datos, lado }: { datos: RespuestaHistorial['por_categoria']; lado: Lado }) {
  const mayor = datos[0]?.items ?? 1;
  return (
    <section
      aria-label={lado === 'ventas' ? 'Lo que más vendiste' : 'Lo que más compraste'}
      className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-5"
    >
      <span className="flex flex-col">
        <span className="text-apoyo text-secundario">
          {lado === 'ventas' ? 'Lo que más vendiste' : 'Lo que más compraste'}
        </span>
        <b className="text-[20px] font-bold leading-7">
          {datos[0] ? `${datos[0].categoria} · ${items(datos[0].items)}` : 'Aún nada este mes'}
        </b>
      </span>
      {datos.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {datos.slice(0, 6).map((fila, i) => (
            <li
              key={fila.categoria}
              className="grid grid-cols-[112px_minmax(0,1fr)_60px] items-center gap-3 text-apoyo sm:grid-cols-[136px_minmax(0,1fr)_64px]"
            >
              <b className="truncate font-bold">{fila.categoria}</b>
              <span className="h-3 overflow-hidden">
                <span
                  className={`block h-full rounded-r ${i === 0 ? 'bg-marca' : 'bg-pase opacity-55'}`}
                  style={{ width: `${Math.round((fila.items / mayor) * 100)}%` }}
                />
              </span>
              <span className="text-right text-secundario">{items(fila.items)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Una venta o compra: el producto, a quién, cuánto, la calificación y «Ver chat». */
function Tarjeta({
  venta,
  lado,
  calificando,
  alRecordar,
  alCalificar,
  alCalificado,
}: {
  venta: VentaEnHistorial;
  lado: Lado;
  calificando: boolean;
  alRecordar: () => void;
  alCalificar: (abrir: boolean) => void;
  alCalificado: (estrellas: number) => void;
}) {
  const estrella = (
    <IconStar size={15} stroke={1.8} className="shrink-0 text-[#D49B00]" aria-hidden="true" />
  );
  return (
    <li className="flex flex-col rounded-2xl border border-linea bg-white">
      <div className="flex items-start gap-3 p-3.5">
        <Miniatura
          ruta={venta.producto.foto}
          categoria={venta.producto.categoria.slug}
          className="h-11 w-11 rounded-lg"
          glifo={30}
          grosor={4}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/p/${venta.producto.slug}`}
            className="text-[15px] font-bold leading-5 text-tinta no-underline hover:underline"
          >
            {venta.producto.titulo}
          </Link>
          <span className="text-apoyo text-secundario">
            {lado === 'ventas' ? 'Vendido a' : 'Comprado a'} {venta.otra_tienda.nombre} ·{' '}
            {TEXTO_MODO_VENTA[venta.modo]}
          </span>
        </span>
        {venta.precio && (
          <b
            className={`shrink-0 text-[16px] font-bold tabular-nums ${
              lado === 'ventas' ? 'text-pase-texto' : 'text-tinta'
            }`}
          >
            {formatearPrecio(venta.precio)}
          </b>
        )}
      </div>
      <div className="mx-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-linea py-3 text-apoyo">
        <span className="flex flex-wrap items-center gap-2">
          {lado === 'ventas' ? (
            venta.calificacion ? (
              <span className="flex items-center gap-1.5 font-bold">
                {estrella}Te calificó {venta.calificacion} ★
              </span>
            ) : (
              <>
                <span className="text-secundario">Aún no te califica</span>
                {venta.puede_recordar ? (
                  <button
                    type="button"
                    onClick={alRecordar}
                    className="h-8 rounded-full border border-borde bg-white px-3 text-nota font-bold"
                  >
                    Recordarle
                  </button>
                ) : (
                  venta.otra_tienda.id && (
                    <span className="text-nota text-detalle">· Ya se lo recordaste</span>
                  )
                )}
              </>
            )
          ) : (
            <>
              <span className="rounded-full bg-superficie px-2.5 py-0.5 text-nota font-bold text-secundario">
                Compra
              </span>
              {venta.calificacion ? (
                <span className="flex items-center gap-1.5 font-bold">
                  {estrella}Calificaste {venta.calificacion} ★
                </span>
              ) : (
                venta.puede_calificar &&
                !calificando && (
                  <button
                    type="button"
                    onClick={() => alCalificar(true)}
                    className="h-8 rounded-full bg-pase px-3.5 text-nota font-bold text-white"
                  >
                    Calificar
                  </button>
                )
              )}
            </>
          )}
        </span>
        {venta.conversacion_id && (
          <Link
            href={`/mensajes/${venta.conversacion_id}`}
            className="flex items-center gap-1.5 font-bold text-pase-texto"
          >
            <IconMessage size={15} stroke={1.8} aria-hidden="true" />
            Ver chat
          </Link>
        )}
      </div>
      {calificando && (
        <div className="px-3.5 pb-3.5">
          <TarjetaCalificar
            ventaId={venta.id}
            tienda={venta.otra_tienda.nombre}
            alTerminar={alCalificado}
          />
        </div>
      )}
    </li>
  );
}

/**
 * «Mis ventas y compras» (HI_A2_Web, HI_A2_Cel, sección 16 del lienzo final): por mes, lo que
 * vendiste con su logro y sus categorías, filtro por tienda, calificaciones, «Recordarle» y
 * «Descargar Excel».
 */
export function PaginaHistorial({ ladoInicial }: { ladoInicial: Lado }) {
  const [lado, setLado] = useState<Lado>(ladoInicial);
  const [mes, setMes] = useState<string | null>(null);
  const [tienda, setTienda] = useState<string | null>(null);
  const [datos, setDatos] = useState<RespuestaHistorial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calificando, setCalificando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(
        await llamarApi<RespuestaHistorial>(`/historial?lado=${lado}${mes ? `&mes=${mes}` : ''}`),
      );
      setError(null);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos cargar tu historial.');
    }
  }, [lado, mes]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function cambiar(cambio: Partial<VentaEnHistorial> & { id: string }) {
    setDatos((antes) =>
      antes
        ? {
            ...antes,
            lista: antes.lista.map((venta) =>
              venta.id === cambio.id ? { ...venta, ...cambio } : venta,
            ),
          }
        : antes,
    );
  }

  async function recordar(venta: VentaEnHistorial) {
    try {
      await llamarApi(`/ventas/${venta.id}/recordar`, { metodo: 'POST', cuerpo: {} });
      cambiar({ id: venta.id, puede_recordar: false });
      setAviso(`Le recordamos a ${venta.otra_tienda.nombre} que te califique.`);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos recordárselo.');
    }
  }

  const mesElegido = datos?.mes ?? mes ?? MES_LIMA.format(new Date()).slice(0, 7);
  const esteMes = mesElegido === MES_LIMA.format(new Date()).slice(0, 7);
  const etiqueta = datos?.meses.find((m) => m.mes === mesElegido)?.etiqueta ?? '';
  const lista = (datos?.lista ?? []).filter((venta) => !tienda || venta.otra_tienda.id === tienda);
  const excel = `/v1/historial/excel?lado=${lado}&mes=${mesElegido}`;

  const chip = (activo: boolean) =>
    `h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-apoyo ${
      activo
        ? 'border-tinta bg-tinta font-bold text-white'
        : 'border-borde bg-white font-medium text-tinta'
    }`;

  const filtroTiendas = (datos?.tiendas.length ?? 0) > 0 && (
    <>
      <button
        type="button"
        aria-pressed={tienda === null}
        onClick={() => setTienda(null)}
        className={chip(tienda === null)}
      >
        Todas
      </button>
      {datos?.tiendas.map((otra) => (
        <button
          key={otra.id}
          type="button"
          aria-pressed={tienda === otra.id}
          onClick={() => setTienda(otra.id)}
          className={chip(tienda === otra.id)}
        >
          {otra.nombre}
        </button>
      ))}
    </>
  );

  // Por día: «Sábado 7 nov».
  const dias: Array<[string, VentaEnHistorial[]]> = [];
  for (const venta of lista) {
    const dia = diaConSemana(venta.fecha);
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo[0] === dia) ultimo[1].push(venta);
    else dias.push([dia, [venta]]);
  }

  return (
    <div className="flex flex-col gap-5">
      <CabeceraMovil
        centro={
          <b className="min-w-0 flex-1 truncate pl-1 text-[20px] font-bold leading-6">Historial</b>
        }
      >
        <a
          href={excel}
          download
          className="mr-1 flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-apoyo font-bold text-tinta no-underline"
        >
          <IconDownload size={16} stroke={2} aria-hidden="true" />
          Excel
        </a>
      </CabeceraMovil>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-md:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Mis ventas y compras</h1>
          <span className="text-apoyo text-secundario">
            Todo lo que vendiste y compraste por PaseLibre.
          </span>
        </div>
        <a
          href={excel}
          download
          className="flex h-11 items-center gap-2 rounded-full bg-pase px-5 font-bold text-white no-underline"
        >
          <IconDownload size={18} stroke={2} aria-hidden="true" />
          Descargar Excel
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div
          role="tablist"
          aria-label="Ventas o compras"
          className="flex rounded-full bg-superficie p-1"
        >
          {(['ventas', 'compras'] as const).map((valor) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={lado === valor}
              onClick={() => {
                setLado(valor);
                setTienda(null);
                setCalificando(null);
              }}
              className={`h-[38px] whitespace-nowrap rounded-full px-4 text-apoyo ${
                lado === valor ? 'bg-tinta font-bold text-white' : 'font-medium text-secundario'
              }`}
            >
              {valor === 'ventas' ? 'Ventas' : 'Compras'}
              {datos ? ` · ${datos.conteos[valor]}` : ''}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Mes" className="flex gap-2 overflow-x-auto max-sm:w-full">
          {datos?.meses.map((otro) => (
            <button
              key={otro.mes}
              type="button"
              aria-pressed={otro.mes === mesElegido}
              onClick={() => {
                setMes(otro.mes);
                setTienda(null);
              }}
              className={chip(otro.mes === mesElegido)}
            >
              {otro.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}

      {datos === null ? (
        !error && <p className="py-8 text-secundario">Cargando…</p>
      ) : (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Logro
              n={datos.conteos.ventas}
              mes={esteMes ? 'Este mes' : `En ${etiqueta.toLowerCase()}`}
              promedio={datos.promedio_ventas}
            />
            <PorCategoria datos={datos.por_categoria} lado={lado} />
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[224px_minmax(0,1fr)]">
            {filtroTiendas ? (
              <aside aria-label="Filtrar por tienda" className="min-w-0">
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:hidden">
                  {filtroTiendas}
                </div>
                <div className="hidden flex-col gap-3 rounded-[20px] border border-linea bg-white p-4 lg:flex">
                  <b className="text-cuerpo font-bold">Tienda</b>
                  <div className="flex flex-wrap gap-2">{filtroTiendas}</div>
                </div>
              </aside>
            ) : (
              <span className="max-lg:hidden" />
            )}

            {dias.length === 0 ? (
              <p className="m-0 rounded-2xl border border-linea px-5 py-10 text-center text-secundario">
                {lado === 'ventas'
                  ? 'Aquí salen las ventas que marcas con «Vendido» en el chat.'
                  : 'Aquí salen tus compras cuando la otra tienda las marca como vendidas.'}
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-3">
                {dias.map(([dia, ventas]) => (
                  <section key={dia} aria-label={dia} className="flex flex-col gap-2">
                    <h2 className="m-0 text-apoyo font-bold text-secundario">{dia}</h2>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                      {ventas.map((venta) => (
                        <Tarjeta
                          key={venta.id}
                          venta={venta}
                          lado={lado}
                          calificando={calificando === venta.id}
                          alRecordar={() => void recordar(venta)}
                          alCalificar={(abrir) => setCalificando(abrir ? venta.id : null)}
                          alCalificado={(estrellas) => {
                            setCalificando(null);
                            cambiar({
                              id: venta.id,
                              calificacion: estrellas,
                              puede_calificar: false,
                            });
                            setAviso('Gracias: tu opinión suma a su reputación.');
                          }}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[460px] items-center justify-between gap-4 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white shadow-[0_12px_28px_rgba(20,22,26,0.24)] md:bottom-8"
        >
          {aviso}
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="h-9 rounded-full px-3 font-bold text-acento"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
