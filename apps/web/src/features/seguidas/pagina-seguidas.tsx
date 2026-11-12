import {
  formatearPrecio,
  type NovedadSeguida,
  type OfertaDeNovedad,
  type RespuestaNovedades,
  textoEstadoDetalle,
} from '@paselibre/contracts';
import { IconDots, IconHeart, IconStar, IconTag, IconTrendingDown } from '@tabler/icons-react';
import Link from 'next/link';

import { BotonResponder } from '@/features/en-vivo/responder';
import { datoPrecio, lineaCantidad } from '@/features/en-vivo/textos';
import { diaCorto, haceCuanto, haceRato, hora } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Miniatura } from '@/shared/ui/miniatura';
import { PrecioBurbuja } from '@/shared/ui/tarjeta-producto';

import { BotonSeguir } from './boton-seguir';

type Tipo = 'todo' | 'nuevos' | 'remates' | 'en_vivo';

const TIPOS: Array<[Tipo, string]> = [
  ['todo', 'Todo'],
  ['nuevos', 'Nuevos'],
  ['remates', 'Remates'],
  ['en_vivo', 'Pedidos en vivo'],
];

/** Un color por tienda, siempre el mismo (SEG_Web): sale de su nombre. */
const COLORES = [
  'bg-pase-medio text-marca',
  'bg-[#DBEAFE] text-[#1E40AF]',
  'bg-[#FFEDD5] text-aviso',
  'bg-[#EDE9FE] text-[#5B21B6]',
  'bg-[#FCE7F3] text-[#9D174D]',
  'bg-[#E0F2FE] text-[#075985]',
];
function colorDe(nombre: string): string {
  let suma = 0;
  for (const letra of nombre) suma += letra.charCodeAt(0);
  return COLORES[suma % COLORES.length] ?? COLORES[0] ?? '';
}

function Avatar({ nombre, tamano = 'h-10 w-10' }: { nombre: string; tamano?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-apoyo font-bold ${tamano} ${colorDe(nombre)}`}
    >
      {iniciales(nombre)}
    </span>
  );
}

/** «hace 12 min» hoy, «ayer 6:40 p. m.» ayer, «5 nov» antes. */
function cuando(iso: string): string {
  const dia = haceCuanto(iso);
  if (dia === 'Hoy') return haceRato(iso).toLowerCase();
  if (dia === 'Ayer') return `ayer ${hora(iso)}`;
  return diaCorto(iso);
}

function Producto({
  oferta,
  antes,
  mas = [],
}: {
  oferta: OfertaDeNovedad;
  antes?: string;
  mas?: string[];
}) {
  return (
    <Link
      href={`/p/${oferta.producto.slug}?oferta=${oferta.id}`}
      className="flex items-center gap-4 text-tinta no-underline"
    >
      <Miniatura
        ruta={oferta.producto.foto}
        categoria={oferta.producto.categoria.slug}
        className="h-[84px] w-[100px] rounded-2xl sm:h-24 sm:w-[120px]"
        glifo={56}
        grosor={3}
      />
      <span className="flex min-w-0 flex-col gap-1">
        <b className="text-cuerpo font-bold hover:underline">{oferta.producto.titulo}</b>
        <span className="text-apoyo text-secundario">
          {textoEstadoDetalle(oferta.detalle)} ·{' '}
          {oferta.stock === 1 ? '1 disponible' : `${oferta.stock} disponibles`}
        </span>
        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <PrecioBurbuja precio={oferta.precio} />
          {antes && <s className="text-apoyo text-secundario">Antes {antes}</s>}
          {oferta.precio_socio && (
            <span className="text-apoyo font-bold text-pase-texto">
              Tu precio socio: {formatearPrecio(oferta.precio_socio)}
            </span>
          )}
        </span>
        {mas.length > 0 && (
          <span className="text-apoyo font-bold text-pase-texto">
            +{mas.length} más: {mas.slice(0, 2).join(' · ')}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Una novedad: quién y qué hizo, con la publicación o el pedido en vivo. */
function Novedad({ novedad }: { novedad: NovedadSeguida }) {
  const { tienda } = novedad;
  const ahora = Date.now();
  const enVivo = novedad.tipo === 'BUSCO' || novedad.tipo === 'REMATE' ? novedad.en_vivo : null;
  const queda = enVivo
    ? Math.max(0, Math.round((new Date(enVivo.vence_en).getTime() - ahora) / 60_000))
    : 0;
  const accion =
    novedad.tipo === 'PUBLICO'
      ? novedad.mas.length > 0
        ? `publicó ${novedad.mas.length + 1} productos · ${cuando(novedad.fecha)}`
        : `publicó ${cuando(novedad.fecha)}`
      : novedad.tipo === 'BAJO'
        ? `bajó de precio · ${cuando(novedad.fecha)}`
        : novedad.tipo === 'REMATE'
          ? `remata · termina en ${queda < 60 ? `${queda} min` : `${Math.round(queda / 60)} h`}`
          : `busca en vivo · ${cuando(novedad.fecha)}`;
  const oscura = novedad.tipo === 'BUSCO';

  return (
    <li
      className={`flex flex-col gap-3.5 rounded-[20px] border p-4 sm:p-5 ${
        oscura ? 'border-tinta bg-tinta text-white' : 'border-linea bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar nombre={tienda.nombre} />
        <span className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/tiendas/${tienda.id}`}
            className={`text-cuerpo font-bold no-underline hover:underline ${oscura ? 'text-white' : 'text-tinta'}`}
          >
            {tienda.nombre}
          </Link>
          <span className={`text-apoyo ${oscura ? 'text-white/75' : 'text-secundario'}`}>
            {accion} · {tienda.lugar}
          </span>
        </span>
        {novedad.tipo === 'REMATE' && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-ambar px-2.5 text-nota font-bold text-ambar-texto">
            <IconTag size={13} stroke={2} aria-hidden="true" />
            Remate
          </span>
        )}
        {novedad.tipo === 'BAJO' && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-pase-suave px-2.5 text-nota font-bold text-pase-texto">
            <IconTrendingDown size={13} stroke={2} aria-hidden="true" />
            Bajó de precio
          </span>
        )}
        {novedad.tipo === 'BUSCO' && (
          <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-nota font-bold">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
            En vivo
          </span>
        )}
      </div>

      {novedad.tipo === 'PUBLICO' && <Producto oferta={novedad.oferta} mas={novedad.mas} />}
      {novedad.tipo === 'BAJO' && (
        <Producto oferta={novedad.oferta} antes={formatearPrecio(novedad.antes)} />
      )}
      {enVivo && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <b className="text-[19px] font-bold leading-6">
              {novedad.tipo === 'BUSCO' ? `Busco ${enVivo.titulo}` : enVivo.titulo}
            </b>
            <span className={`text-apoyo ${oscura ? 'text-white/80' : 'text-secundario'}`}>
              {[lineaCantidad(enVivo) || null, datoPrecio(enVivo)].filter(Boolean).join(' · ')}
            </span>
          </span>
          <BotonResponder
            item={enVivo}
            className="inline-flex h-11 items-center rounded-full bg-contador px-5 font-bold text-tinta no-underline"
          />
        </div>
      )}
    </li>
  );
}

/** El encabezado del día: «HOY», «AYER» o «5 NOV». */
function grupoDe(iso: string): string {
  const dia = haceCuanto(iso);
  return dia === 'Hoy' || dia === 'Ayer' ? dia : diaCorto(iso);
}

/**
 * «De tiendas que sigues» (SEG_Web, SEG_Cel, sección 8 del lienzo final): lo que publicaron,
 * bajaron de precio o piden en vivo, por día; filtro por tienda y por tipo, y sugerencias.
 * Sin seguir a nadie, SEG_WebVacio con las tiendas que te pueden interesar.
 */
export function PaginaSeguidas({
  datos,
  tienda,
  tipo,
}: {
  datos: RespuestaNovedades;
  tienda: string | null;
  tipo: Tipo;
}) {
  const enlace = (cambios: { tienda?: string | null; tipo?: Tipo }) => {
    const parametros = new URLSearchParams();
    const elegida = cambios.tienda === undefined ? tienda : cambios.tienda;
    const elegido = cambios.tipo ?? tipo;
    if (elegida) parametros.set('tienda', elegida);
    if (elegido !== 'todo') parametros.set('tipo', elegido);
    const texto = parametros.toString();
    return `/tiendas-que-sigues${texto ? `?${texto}` : ''}`;
  };
  const encabezado = (
    <>
      <CabeceraMovil titulo="De tiendas que sigues" />
      <div className="flex flex-col gap-1 max-md:hidden">
        <nav aria-label="Ruta" className="flex gap-2 text-nota text-detalle">
          <Link href="/" className="text-secundario">
            Inicio
          </Link>
          <span aria-hidden="true">›</span>
          <span>De tiendas que sigues</span>
        </nav>
        <h1 className="text-titulo">De tiendas que sigues</h1>
      </div>
    </>
  );

  if (datos.seguidas.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {encabezado}
        <section className="flex flex-col items-center gap-3 px-4 py-6 text-center">
          <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-pase-medio text-marca">
            <IconHeart size={30} stroke={1.8} aria-hidden="true" />
          </span>
          <h2 className="text-[24px] font-bold leading-8">Aún no sigues a ninguna tienda</h2>
          <p className="m-0 max-w-[500px] text-cuerpo text-secundario">
            Sigue a las tiendas que te interesan y aquí verás todo lo que publiquen: productos
            nuevos, remates y lo que están buscando. Así no se te escapa nada.
          </p>
        </section>
        {datos.sugeridas.length > 0 && (
          <section aria-labelledby="sugeridas" className="flex flex-col gap-3">
            <h2 id="sugeridas" className="text-cuerpo font-bold">
              Tiendas que te pueden interesar
            </h2>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {datos.sugeridas.map((sugerida) => (
                <li
                  key={sugerida.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4"
                >
                  <span className="flex items-center gap-3">
                    <Avatar nombre={sugerida.nombre} tamano="h-12 w-12" />
                    <span className="flex min-w-0 flex-col">
                      <Link
                        href={`/tiendas/${sugerida.id}`}
                        className="text-cuerpo font-bold text-tinta no-underline hover:underline"
                      >
                        {sugerida.nombre}
                      </Link>
                      <span className="text-apoyo text-secundario">{sugerida.lugar}</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-apoyo text-secundario">
                    {sugerida.estrellas !== null && (
                      <>
                        <IconStar size={15} stroke={1.8} aria-hidden="true" />
                        <b className="font-bold text-tinta">
                          {sugerida.estrellas.toLocaleString('es-PE')}
                        </b>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    {sugerida.vende
                      ? `Vende sobre todo ${sugerida.vende.toLowerCase()}`
                      : 'Aún sin publicaciones'}
                  </span>
                  <span className="self-start rounded-full bg-superficie px-2.5 py-1 text-nota font-bold text-secundario">
                    {sugerida.por}
                  </span>
                  <BotonSeguir tiendaId={sugerida.id} nombre={sugerida.nombre} ancho />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  const dias: Array<[string, NovedadSeguida[]]> = [];
  for (const novedad of datos.novedades) {
    const grupo = grupoDe(novedad.fecha);
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo[0] === grupo) ultimo[1].push(novedad);
    else dias.push([grupo, [novedad]]);
  }
  const chip = (activo: boolean) =>
    `flex h-10 shrink-0 items-center rounded-full border px-4 text-apoyo no-underline ${
      activo
        ? 'border-tinta bg-tinta font-bold text-white'
        : 'border-borde bg-white font-medium text-tinta'
    }`;

  return (
    <div className="flex flex-col gap-5">
      {encabezado}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <nav
            aria-label="Tiendas que sigues"
            className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
          >
            <Link
              href={enlace({ tienda: null })}
              aria-current={!tienda ? 'true' : undefined}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-tinta no-underline"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-tinta text-white ${
                  !tienda ? 'ring-2 ring-pase ring-offset-2' : ''
                }`}
              >
                <IconDots size={20} stroke={2} aria-hidden="true" />
              </span>
              <span className={`text-nota ${!tienda ? 'font-bold' : 'text-secundario'}`}>
                Todas
              </span>
            </Link>
            {datos.seguidas.map((seguida) => (
              <Link
                key={seguida.id}
                href={enlace({ tienda: seguida.id })}
                aria-current={tienda === seguida.id ? 'true' : undefined}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-tinta no-underline"
              >
                <span className="relative">
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-bold ${colorDe(seguida.nombre)} ${
                      tienda === seguida.id ? 'ring-2 ring-pase ring-offset-2' : ''
                    }`}
                  >
                    {iniciales(seguida.nombre)}
                  </span>
                  {seguida.nuevo_hoy && (
                    <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-pase">
                      <span className="sr-only">Publicó hoy</span>
                    </span>
                  )}
                </span>
                <span
                  className={`w-full truncate text-center text-nota ${tienda === seguida.id ? 'font-bold' : 'text-secundario'}`}
                >
                  {seguida.nombre}
                </span>
              </Link>
            ))}
          </nav>
          <nav
            aria-label="Qué ver"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
          >
            {TIPOS.map(([clave, texto]) => (
              <Link
                key={clave}
                href={enlace({ tipo: clave })}
                scroll={false}
                aria-current={tipo === clave ? 'true' : undefined}
                className={chip(tipo === clave)}
              >
                {texto}
              </Link>
            ))}
          </nav>
          {dias.length === 0 ? (
            <p className="m-0 rounded-[20px] border border-linea px-5 py-10 text-center text-secundario">
              Nada por aquí con este filtro. Prueba con «Todo».
            </p>
          ) : (
            dias.map(([dia, lista]) => (
              <section key={dia} aria-label={dia} className="flex flex-col gap-3">
                <h2 className="m-0 text-etiqueta uppercase text-detalle">{dia}</h2>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {lista.map((novedad) => (
                    <Novedad
                      key={`${novedad.tipo}-${'oferta' in novedad ? novedad.oferta.id : novedad.en_vivo.id}`}
                      novedad={novedad}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-2 rounded-[20px] border border-linea bg-white p-5">
            <b className="text-cuerpo font-bold">
              Sigues a {datos.seguidas.length} {datos.seguidas.length === 1 ? 'tienda' : 'tiendas'}
            </b>
            <p className="m-0 text-apoyo text-secundario">
              Sus publicaciones también salen arriba en tu inicio. Te avisamos según lo que elegiste
              en cada una.
            </p>
            <Link href="/avisos#configurar" className="text-apoyo font-bold text-pase-texto">
              Administrar avisos ›
            </Link>
          </section>
          {datos.sugeridas.length > 0 && (
            <section
              aria-labelledby="te-pueden"
              className="flex flex-col overflow-hidden rounded-[20px] border border-linea bg-white"
            >
              <h2 id="te-pueden" className="m-0 px-4 py-3.5 text-cuerpo font-bold">
                Te pueden interesar
              </h2>
              <ul className="m-0 list-none p-0">
                {datos.sugeridas.slice(0, 3).map((sugerida) => (
                  <li
                    key={sugerida.id}
                    className="flex items-center gap-3 border-t border-linea px-4 py-3"
                  >
                    <Avatar nombre={sugerida.nombre} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Link
                        href={`/tiendas/${sugerida.id}`}
                        className="truncate text-apoyo font-bold text-tinta no-underline hover:underline"
                      >
                        {sugerida.nombre}
                      </Link>
                      <span className="truncate text-nota text-secundario">{sugerida.por}</span>
                    </span>
                    <BotonSeguir tiendaId={sugerida.id} nombre={sugerida.nombre} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
