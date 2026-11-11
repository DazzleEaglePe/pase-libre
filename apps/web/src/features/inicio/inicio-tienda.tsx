import {
  formatearPrecio,
  type RespuestaInicio,
  type RespuestaYo,
  type TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import { IconCheck, IconLock } from '@tabler/icons-react';
import Link from 'next/link';

import { iniciales } from '@/shared/iniciales';

import { PedidosEnVivoAhora, SaludoTienda } from './en-vivo-ahora';
import { PilotoGaleria, PrimerosPasos } from './piloto';
import { TarjetaInicio, TarjetaNueva, TarjetaRecienLlegada } from './tarjetas';

type Categoria = { slug: string; nombre: string; productos: number };

/** «De tiendas que sigues» (SG_WebFeed): 4 tarjetas con «Sigues». */
function DeSeguidas({ datos }: { datos: RespuestaInicio['de_seguidas'] }) {
  if (datos.ofertas.length === 0) return null;
  const nombres =
    datos.tiendas.length > 1
      ? `${datos.tiendas.slice(0, -1).join(', ')} y ${datos.tiendas[datos.tiendas.length - 1]}`
      : (datos.tiendas[0] ?? '');
  return (
    <section aria-labelledby="de-seguidas" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="de-seguidas" className="tit text-[22px] leading-7">
          De tiendas que sigues
        </h2>
        <Link href="/tiendas-que-sigues" className="text-apoyo text-secundario">
          {nombres}
        </Link>
      </div>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {datos.ofertas.map((tarjeta) => (
          <div key={tarjeta.oferta_id} className="w-[170px] shrink-0 sm:w-auto">
            <TarjetaInicio tarjeta={tarjeta} seguida />
          </div>
        ))}
      </div>
    </section>
  );
}

/** «RECIÉN LLEGADOS» del inicio normal (COR25): 2 filas de 4, mezcladas por tienda. */
function RecienLlegados({ tarjetas }: { tarjetas: TarjetaOfertaConVendedor[] }) {
  const ocho = tarjetas.slice(0, 8);
  return (
    <section aria-labelledby="recientes" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="recientes" className="tit text-[22px] leading-7">
          Recién llegados
        </h2>
        <Link href="/buscar?orden=recientes" className="text-apoyo font-bold text-pase-texto">
          Ver todo ›
        </Link>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
        {ocho.map((tarjeta) => (
          <div key={tarjeta.oferta_id} className="flex w-[200px] shrink-0 sm:w-auto">
            <TarjetaRecienLlegada tarjeta={tarjeta} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ExploraCategorias({ categorias }: { categorias: Categoria[] }) {
  return (
    <section aria-labelledby="explora" className="flex flex-col gap-3">
      <h2 id="explora" className="tit text-[22px] leading-7">
        Explora por categoría
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {categorias
          .filter((categoria) => categoria.productos > 0)
          .map((categoria) => (
            <li key={categoria.slug}>
              <Link
                href={`/categorias/${categoria.slug}`}
                className="flex h-11 items-center rounded-full border border-borde bg-white px-4 text-cuerpo font-medium text-tinta no-underline hover:border-borde-control"
              >
                {categoria.nombre}
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}

/**
 * «Tus precios de pase están protegidos» (FI_Web): cómo ve una tienda y cómo ve alguien sin
 * cuenta la misma publicación.
 */
function Protegidos({ ejemplo }: { ejemplo: TarjetaOfertaConVendedor | undefined }) {
  const titulo = ejemplo?.producto.titulo ?? 'MSI RTX 3070 Ventus 3X';
  const precio = ejemplo?.precio ? formatearPrecio(ejemplo.precio) : 'US$ 285';
  const tienda = ejemplo
    ? [ejemplo.tienda.nombre, ejemplo.tienda.stand && `Stand ${ejemplo.tienda.stand}`]
        .filter(Boolean)
        .join(' · ')
    : 'Computer Shock · Stand 214';
  const galeria = ejemplo?.galeria ?? 'CyberPlaza';
  return (
    <section
      aria-labelledby="protegidos"
      className="grid gap-6 rounded-[28px] bg-[linear-gradient(135deg,#0F1412,#173A2C)] p-5 text-white sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,390px)]"
    >
      <div className="flex flex-col gap-3">
        <span className="flex items-center gap-1.5 self-start rounded-full bg-acento px-3 py-1 text-nota font-bold text-tinta">
          <IconLock size={13} stroke={2.2} aria-hidden="true" />
          Solo para tiendas de Wilson
        </span>
        <h2 id="protegidos" className="text-[26px] font-bold leading-8">
          Tus precios de pase están protegidos
        </h2>
        <p className="m-0 text-cuerpo text-white/85">
          PaseLibre es privado para tiendas y galerías de Wilson. Un cliente final nunca ve tus
          precios.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-cuerpo">
          {[
            'Cada tienda entra verificada: con RUC o revisada por una persona del equipo.',
            'Sin cuenta de tienda nadie ve tus precios ni el nombre de tu tienda, ni con un enlace.',
            'Si detectamos a un cliente final, le cerramos la cuenta.',
          ].map((texto) => (
            <li key={texto} className="flex gap-2.5">
              <IconCheck
                size={18}
                stroke={2.2}
                className="mt-0.5 shrink-0 text-acento"
                aria-hidden="true"
              />
              {texto}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3 self-start">
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-tinta">
          <span className="text-etiqueta uppercase text-pase-texto">Así lo ves tú</span>
          <b className="text-cuerpo font-bold">{titulo}</b>
          <span className="flex flex-wrap items-center gap-2 text-apoyo text-secundario">
            <b className="rounded-full bg-tinta px-3 py-0.5 text-[17px] font-bold text-white">
              {precio}
            </b>
            {tienda}
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/30 p-4">
          <span className="text-etiqueta uppercase text-white/75">
            Así lo ve alguien sin cuenta
          </span>
          <b className="text-cuerpo font-bold">{titulo}</b>
          <span className="flex flex-wrap items-center gap-1.5 text-apoyo text-white/80">
            <IconLock size={15} stroke={2} aria-hidden="true" />
            <b className="font-bold text-white">Precio con sesión</b> · Tienda de {galeria}
          </span>
        </div>
      </div>
    </section>
  );
}

/** «Lo que más se pide en la galería»: si lo tienes, publícalo primero. */
function MasPedido({ lista }: { lista: RespuestaInicio['mas_pedido'] }) {
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="mas-pedido" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id="mas-pedido" className="text-[20px] font-bold leading-7">
          Lo que más se pide en la galería
        </h2>
        <span className="text-apoyo text-secundario">
          Según lo que más se busca en Wilson. Si lo tienes, publícalo primero y te encuentran a ti.
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {lista.map((item) => (
          <li
            key={item.producto ?? item.texto}
            className="flex items-center justify-between gap-3 border-b border-linea py-3"
          >
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-cuerpo font-bold">{item.texto}</b>
              <span className="text-apoyo text-secundario">
                {item.producto
                  ? `${item.categoria} · ya está en el catálogo`
                  : 'Aún no está en el catálogo'}
              </span>
            </span>
            <Link
              href={item.producto ? `/publicar?igual=${item.producto}` : '/publicar'}
              className="flex h-10 shrink-0 items-center rounded-full border border-borde px-3.5 text-nota font-bold text-tinta no-underline hover:bg-superficie"
            >
              ¿Lo tienes? Publícalo
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Tiendas que ya están»: las que muestran su nombre y cuántas están en reservado. */
function TiendasQueYaEstan({ tiendas }: { tiendas: RespuestaInicio['tiendas'] }) {
  if (tiendas.visibles.length === 0 && tiendas.reservadas === 0) return null;
  return (
    <section aria-labelledby="ya-estan" className="flex flex-col gap-3">
      <h2 id="ya-estan" className="text-[20px] font-bold leading-7">
        Tiendas que ya están
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {tiendas.visibles.slice(0, 7).map((tienda) => (
          <li key={tienda.id}>
            <Link
              href={`/tiendas/${tienda.id}`}
              className="flex h-full flex-col items-center gap-1.5 rounded-2xl border border-linea bg-white px-3 py-4 text-center text-tinta no-underline hover:border-borde"
            >
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-pase-suave text-cuerpo font-bold text-marca"
              >
                {iniciales(tienda.nombre)}
              </span>
              <b className="text-apoyo font-bold">{tienda.nombre}</b>
              <span className="text-nota text-secundario">{tienda.detalle}</span>
            </Link>
          </li>
        ))}
        {tiendas.reservadas > 0 && (
          <li className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-borde px-3 py-4 text-center">
            <b className="text-[20px] font-bold">+{tiendas.reservadas}</b>
            <span className="text-nota text-secundario">
              {tiendas.reservadas === 1 ? 'tienda en modo reservado' : 'tiendas en modo reservado'}
            </span>
          </li>
        )}
      </ul>
      <span className="text-nota text-secundario">
        Solo salen las que eligieron mostrar su nombre. Las reservadas cuentan, pero no se muestran.
      </span>
    </section>
  );
}

/**
 * El inicio de una tienda (sección 5 del lienzo final): crece solo. Con 12 o más publicaciones
 * de otras tiendas es el de todos los días (FI_WebNormal); con menos, muestra lo poco que hay
 * en fila (FI_WebPocas); sin nada, invita a pedir en vivo y guía con «Primeros pasos» (FI_Web).
 * Arriba de todo, lo nuevo de las tiendas que sigues (SG_WebFeed).
 */
export function InicioTienda({
  sesion,
  inicio,
  recientes,
  categorias,
}: {
  sesion: RespuestaYo;
  inicio: RespuestaInicio;
  recientes: TarjetaOfertaConVendedor[];
  categorias: Categoria[];
}) {
  const ajenas = recientes.filter((tarjeta) => !tarjeta.propia);

  if (inicio.fase === 'NORMAL') {
    return (
      <div className="flex flex-col gap-8">
        <SaludoTienda sesion={sesion} />
        <PedidosEnVivoAhora />
        <DeSeguidas datos={inicio.de_seguidas} />
        <RecienLlegados tarjetas={recientes} />
        <ExploraCategorias categorias={categorias} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <SaludoTienda sesion={sesion} />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <aside className="flex flex-col gap-5 lg:order-2">
          <PilotoGaleria tiendas={inicio.tiendas} miTienda={sesion.tienda?.nombre ?? ''} />
          {inicio.fase === 'DIA_1' && <PrimerosPasos pasos={inicio.pasos} />}
        </aside>
        <div className="flex min-w-0 flex-col gap-10 lg:order-1">
          <PedidosEnVivoAhora />
          <DeSeguidas datos={inicio.de_seguidas} />
          {inicio.fase === 'POCAS' && ajenas.length > 0 && (
            <section aria-labelledby="lo-nuevo" className="flex flex-col gap-3">
              <h2 id="lo-nuevo" className="text-[20px] font-bold leading-7">
                Lo nuevo ·{' '}
                {ajenas.length === 1 ? '1 publicación' : `${ajenas.length} publicaciones`}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ajenas.map((tarjeta) => (
                  <TarjetaNueva key={tarjeta.oferta_id} tarjeta={tarjeta} />
                ))}
              </div>
              <span className="text-nota text-secundario">
                Cada producto nuevo de la galería aparece aquí arriba. Publica el tuyo y sale
                primero.
              </span>
            </section>
          )}
          <Protegidos ejemplo={ajenas.find((tarjeta) => tarjeta.precio)} />
          <MasPedido lista={inicio.mas_pedido} />
          <TiendasQueYaEstan tiendas={inicio.tiendas} />
        </div>
      </div>
    </div>
  );
}
