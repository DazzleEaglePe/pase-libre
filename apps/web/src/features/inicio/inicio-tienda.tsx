import {
  PUBLICACIONES_INICIO_NORMAL,
  type RespuestaInicio,
  type RespuestaYo,
} from '@paselibre/contracts';
import { IconCheck, IconInfoCircle, IconLock } from '@tabler/icons-react';
import Link from 'next/link';

import { iniciales } from '@/shared/iniciales';
import { enPlural } from '@/shared/plural';

import { BannerInvitar } from './banner-invitar';
import { PedidosEnVivo, SaludoTienda } from './en-vivo-ahora';
import { PilotoGaleria, PrimerosPasos } from './piloto';
import { RecienPublicado } from './recien-publicado';
import { FilaNueva } from './tarjetas';

type Categoria = { slug: string; nombre: string; productos: number };

const titulo = 'tit text-[22px] leading-7 max-sm:text-[19px] max-sm:leading-6';

function ExploraCategorias({ categorias }: { categorias: Categoria[] }) {
  const conProductos = categorias.filter((categoria) => categoria.productos > 0);
  if (conProductos.length === 0) return null;
  return (
    <section aria-labelledby="explora" className="flex flex-col gap-3.5">
      <h2 id="explora" className={titulo}>
        Explora por categoría
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
        {conProductos.map((categoria) => (
          <li key={categoria.slug}>
            <Link
              href={`/categorias/${categoria.slug}`}
              className="flex h-11 items-center rounded-full border-[1.5px] border-borde bg-white px-4 text-cuerpo font-semibold text-tinta no-underline hover:border-borde-control"
            >
              {categoria.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Tus precios de pase están protegidos» (N16, día 1): por qué ninguna cuenta sin tienda los ve. */
function Protegidos() {
  return (
    <section
      aria-labelledby="protegidos"
      className="flex flex-col gap-2.5 rounded-[18px] bg-[#003D29] px-[22px] py-5 text-white"
    >
      <span className="flex items-center gap-[5px] self-start rounded-full bg-[#4ADE80] px-2.5 py-[3px] text-[11px] font-extrabold text-tinta">
        <IconLock size={12} stroke={1.8} aria-hidden="true" />
        Solo para tiendas de Wilson
      </span>
      <h2 id="protegidos" className="text-[22px] font-bold leading-7">
        Tus precios de pase están protegidos
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-cuerpo">
        {[
          'Cada tienda entra verificada: con RUC o revisada por una persona del equipo.',
          'Sin cuenta de tienda nadie ve tus precios ni el nombre de tu tienda, ni con un enlace.',
          'Si detectamos a un cliente final, le cerramos la cuenta.',
        ].map((texto) => (
          <li key={texto} className="flex gap-2.5">
            <IconCheck
              size={17}
              stroke={2.2}
              className="mt-0.5 shrink-0 text-[#4ADE80]"
              aria-hidden="true"
            />
            {texto}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Lo que más se pide en la galería»: si lo tienes, publícalo primero. */
function MasPedido({ lista }: { lista: RespuestaInicio['mas_pedido'] }) {
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="mas-pedido" className="flex flex-col gap-2">
      <h2 id="mas-pedido" className={titulo}>
        Lo que más se pide en la galería
      </h2>
      <span className="text-cuerpo text-secundario">
        Según lo que más se mueve en Wilson. Si lo tienes, publícalo primero y te encuentran a ti.
      </span>
      <ul className="m-0 mt-2 list-none p-0">
        {lista.map((item) => (
          <li
            key={item.producto ?? item.texto}
            className="flex items-center justify-between gap-3 border-b-[1.5px] border-linea py-3"
          >
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[16px] font-bold">{item.texto}</b>
              <span className="text-nota text-detalle">
                {item.producto
                  ? `${item.categoria} · ya está en el catálogo`
                  : 'Aún no está en el catálogo'}
              </span>
            </span>
            <Link
              href={item.producto ? `/publicar?igual=${item.producto}` : '/publicar'}
              className="flex h-9 shrink-0 items-center rounded-full border-[1.5px] border-tinta bg-white px-3.5 text-nota font-bold text-tinta no-underline hover:bg-superficie"
            >
              ¿Lo tienes? Publícalo
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * «Tiendas que ya están»: las que muestran su nombre y «+2 tiendas en modo reservado», que
 * cuentan pero nunca se dice cuáles son (eso lo decide la API).
 */
function TiendasQueYaEstan({ tiendas }: { tiendas: RespuestaInicio['tiendas'] }) {
  if (tiendas.visibles.length === 0 && tiendas.reservadas === 0) return null;
  return (
    <section aria-labelledby="ya-estan" className="flex flex-col gap-3.5">
      <h2 id="ya-estan" className={titulo}>
        Tiendas que ya están
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
        {tiendas.visibles.slice(0, 7).map((tienda) => (
          <li key={tienda.id}>
            <Link
              href={`/tiendas/${tienda.id}`}
              className="flex h-full flex-col items-center gap-1.5 rounded-2xl border-[1.5px] border-borde bg-white px-2.5 py-4 text-center text-tinta no-underline hover:border-borde-control"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-pase-medio text-[15px] font-extrabold text-marca"
              >
                {iniciales(tienda.nombre)}
              </span>
              <b className="text-apoyo font-bold">{tienda.nombre}</b>
              <span className="text-[12px] leading-4 text-detalle">{tienda.detalle}</span>
            </Link>
          </li>
        ))}
        {tiendas.reservadas > 0 && (
          <li className="flex flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-[#9AA6A0] px-2.5 py-3.5 text-center">
            <b className="text-[22px] font-bold">+{tiendas.reservadas}</b>
            <span className="text-[12px] leading-4 text-detalle">
              {enPlural(tiendas.reservadas, 'tienda', 'tiendas')} en modo reservado
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}

/** «Van 3 de 12 publicaciones…» (N16, primera semana). */
function VanDeDoce({ publicaciones }: { publicaciones: number }) {
  return (
    <p className="m-0 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[#9AA6A0] bg-white px-4 py-3 text-nota text-secundario">
      <IconInfoCircle size={18} stroke={1.8} className="shrink-0 text-marca" aria-hidden="true" />
      <span>
        Van{' '}
        <b className="text-tinta">
          {publicaciones} de {PUBLICACIONES_INICIO_NORMAL}
        </b>{' '}
        {enPlural(publicaciones, 'publicación', 'publicaciones')}. Al llegar a{' '}
        {PUBLICACIONES_INICIO_NORMAL}, el inicio cambia solo al normal y ya no vuelve atrás.
      </span>
    </p>
  );
}

/**
 * El inicio de una tienda (N16, N15): crece solo y lo decide la API.
 * - Día 1 (nadie más publicó): bienvenida, pedidos en vivo, precios protegidos, lo que más se
 *   pide, tiendas que ya están, el piloto y primeros pasos. Nunca una cuadrícula vacía.
 * - De 1 a 11: lo nuevo en lista con «Van 3 de 12»; el piloto se achica.
 * - Desde 12 (y ya no vuelve atrás): pedidos en vivo en el rectángulo negro, «Recién publicado»
 *   en 4 filas de hasta 18, cada una con su flecha (docs/18 §5), y las categorías.
 * Al final, el banner para invitar a otra tienda, hasta que se cierre con la X.
 */
export function InicioTienda({
  sesion,
  inicio,
  categorias,
}: {
  sesion: RespuestaYo;
  inicio: RespuestaInicio;
  categorias: Categoria[];
}) {
  const banner = <BannerInvitar cerrado={inicio.invitar_cerrado} />;

  if (inicio.fase === 'NORMAL') {
    return (
      <div className="flex flex-col gap-8 max-sm:gap-6">
        <SaludoTienda sesion={sesion} />
        <PedidosEnVivo />
        <RecienPublicado tarjetas={inicio.recien} total={inicio.total} />
        <ExploraCategorias categorias={categorias} />
        {banner}
      </div>
    );
  }

  const dia1 = inicio.fase === 'DIA_1';
  const miTienda = sesion.tienda?.nombre ?? '';
  return (
    <div className="flex flex-col gap-6">
      {/* En el celular: el día 1 lleva el piloto arriba y los pasos al final; la primera semana,
          lo nuevo primero y el piloto con los pasos al final (N15_InicioCel). */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="lg:col-start-1 lg:row-start-1">
          <SaludoTienda sesion={sesion} />
        </div>
        <aside
          aria-label="Tu avance"
          className={`flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${
            dia1 ? '' : 'max-lg:order-last'
          }`}
        >
          <PilotoGaleria tiendas={inicio.tiendas} miTienda={miTienda} compacto={!dia1} />
          <div className={dia1 ? 'max-lg:hidden' : ''}>
            <PrimerosPasos pasos={inicio.pasos} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-2">
          <PedidosEnVivo />
          {dia1 ? (
            <>
              <Protegidos />
              <MasPedido lista={inicio.mas_pedido} />
              <TiendasQueYaEstan tiendas={inicio.tiendas} />
            </>
          ) : (
            <>
              <VanDeDoce publicaciones={inicio.publicaciones} />
              <section aria-labelledby="lo-nuevo" className="flex flex-col gap-1">
                <h2 id="lo-nuevo" className={titulo}>
                  Lo nuevo en la galería
                </h2>
                <ul className="m-0 list-none p-0">
                  {inicio.recien.map((tarjeta) => (
                    <FilaNueva key={tarjeta.oferta_id} tarjeta={tarjeta} />
                  ))}
                </ul>
              </section>
              <MasPedido lista={inicio.mas_pedido.slice(0, 2)} />
            </>
          )}
        </div>
        {dia1 && (
          <div className="lg:hidden">
            <PrimerosPasos pasos={inicio.pasos} />
          </div>
        )}
      </div>
      {banner}
    </div>
  );
}
