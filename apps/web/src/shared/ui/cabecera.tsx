'use client';

import type {
  CategoriaResumen,
  GaleriaResumen,
  RespuestaYo,
  TiendaDeSesion,
} from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

import { Buscador } from './buscador';
import { Campanita, Insignia, useContadores } from './campanita';
import { Marca } from './marca';
import { MenuCuenta } from './menu-cuenta';

const VENTAJAS = [
  'Pases entre tiendas de Wilson',
  'Gratis para el piloto',
  'Precios solo con sesión',
  'Busca aunque escribas mal',
  'Chat y WhatsApp',
  'El trato es entre vendedores',
];

const soporte = enlaceWhatsappEquipo('Hola, necesito ayuda con PaseLibre.');

const enlaceSuave = 'text-secundario no-underline hover:text-tinta';
const enlaceFuerte = 'font-semibold text-tinta no-underline hover:underline';

/**
 * «Galería» de la fila de arriba (RF-17): en la portada filtra lo recién publicado; en
 * cualquier otra página lleva a los resultados de esa galería, sin perder lo que se buscaba.
 */
function SelectorGaleria({ galerias }: { galerias: GaleriaResumen[] }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const actual = ruta === '/' || ruta === '/buscar' ? (parametros.get('galeria') ?? '') : '';

  function elegir(slug: string) {
    if (ruta === '/') {
      router.push(slug ? `/?galeria=${encodeURIComponent(slug)}` : '/');
      return;
    }
    const siguiente = new URLSearchParams(ruta === '/buscar' ? parametros.toString() : '');
    if (slug) siguiente.set('galeria', slug);
    else siguiente.delete('galeria');
    siguiente.delete('pagina');
    const consulta = siguiente.toString();
    router.push(consulta ? `/buscar?${consulta}` : '/buscar');
  }

  return (
    <label className="flex items-center gap-1.5 text-secundario">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      Galería
      <select
        value={actual.includes(',') ? '' : actual}
        onChange={(evento) => elegir(evento.target.value)}
        className="h-8 cursor-pointer bg-transparent pr-1 font-semibold text-tinta"
      >
        <option value="">Todas</option>
        {galerias.map((galeria) => (
          <option key={galeria.slug} value={galeria.slug}>
            {galeria.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

/** La campanita, Mensajes con su contador y «Mi cuenta». Solo se monta con tienda. */
function AccionesVendedor({ tienda }: { tienda: TiendaDeSesion }) {
  const ruta = usePathname();
  const contadores = useContadores();
  const enMensajes = ruta.startsWith('/mensajes');
  const lugar = [tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-1">
      <Campanita sinLeer={contadores.avisos} />
      <Link
        href="/mensajes"
        aria-label={
          contadores.mensajes > 0 ? `Mensajes, ${contadores.mensajes} sin leer` : 'Mensajes'
        }
        aria-current={enMensajes ? 'page' : undefined}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-tinta ${
          enMensajes ? 'bg-superficie' : 'hover:bg-superficie'
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        <Insignia cantidad={contadores.mensajes} />
      </Link>
      <MenuCuenta tienda={tienda} lugar={lugar} />
    </div>
  );
}

function BandaCategorias({ categorias }: { categorias: CategoriaResumen[] }) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const enResultados = ruta === '/buscar';
  const actual = enResultados ? parametros.get('categoria') : null;

  const clase = (activa: boolean) =>
    `flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-apoyo font-semibold text-white no-underline ${
      activa ? 'border-acento' : 'border-transparent hover:border-white/40'
    }`;

  return (
    <nav aria-label="Categorías" className="bg-tinta">
      <div className="mx-auto flex max-w-[1280px] items-center overflow-x-auto px-1 [scrollbar-width:none] sm:px-5">
        <Link
          href="/buscar"
          aria-current={enResultados && !actual ? 'page' : undefined}
          className={clase(enResultados && !actual)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
          </svg>
          Todas las categorías
        </Link>
        {categorias.map((categoria) => {
          const activa = actual === categoria.slug;
          return (
            <Link
              key={categoria.slug}
              href={`/buscar?categoria=${categoria.slug}`}
              aria-current={activa ? 'page' : undefined}
              className={clase(activa)}
            >
              {categoria.nombre}
            </Link>
          );
        })}
        {/* «Soporte» del lienzo: el WhatsApp del equipo cuando exista; mientras, la ayuda. */}
        {soporte ? (
          <a
            href={soporte}
            target="_blank"
            rel="noopener noreferrer"
            className={`${clase(false)} ml-auto text-acento max-md:hidden`}
          >
            Soporte por WhatsApp
          </a>
        ) : (
          <Link
            href="/ayuda"
            className={`${clase(ruta === '/ayuda')} ml-auto text-acento max-md:hidden`}
          >
            Ayuda y soporte
          </Link>
        )}
      </div>
    </nav>
  );
}

/**
 * La barra de todas las páginas (C_Header del lienzo, en Hielo), igual con sesión y sin
 * ella. De arriba abajo: la fila del saludo y la galería, el logo con su frase y el buscador,
 * la banda de categorías en azul noche y la franja de ventajas. En el celular quedan el logo,
 * el buscador y la banda, como en F_MovilPortada. En Mensajes va sin banda ni franja: el
 * chat necesita el alto.
 */
export function Cabecera({
  sesion,
  categorias,
  galerias,
}: {
  sesion: RespuestaYo | null;
  categorias: CategoriaResumen[];
  galerias: GaleriaResumen[];
}) {
  const ruta = usePathname();
  const completa = !ruta.startsWith('/mensajes');
  const tienda = sesion?.tienda ?? null;

  return (
    <header>
      <div className="border-b border-linea text-nota max-md:hidden">
        <div className="mx-auto flex min-h-10 max-w-[1280px] flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {sesion ? (
              <span>
                ¡Hola, <b className="font-semibold">{tienda?.nombre ?? sesion.usuario.nombre}</b>!
              </span>
            ) : (
              <span>
                ¡Hola!{' '}
                <Link href="/ingresar" className={enlaceFuerte}>
                  Inicia sesión
                </Link>{' '}
                o{' '}
                <Link href="/ingresar?pestana=crear" className={enlaceFuerte}>
                  pide tu cuenta
                </Link>
              </span>
            )}
            <Link href="/ayuda" className={enlaceSuave}>
              Cómo funciona
            </Link>
            <Link href="/ayuda" className={enlaceSuave}>
              Ayuda y contacto
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {galerias.length > 0 && (
              <Suspense fallback={null}>
                <SelectorGaleria galerias={galerias} />
              </Suspense>
            )}
            {sesion && !tienda ? (
              <>
                <Link href="/equipo/cuentas" className={enlaceFuerte}>
                  Panel del equipo
                </Link>
                <BotonSalir />
              </>
            ) : (
              <Link href="/publicar" className={enlaceFuerte}>
                Publicar
              </Link>
            )}
            {!sesion && (
              <Link href="/ingresar" className={enlaceFuerte}>
                Mi cuenta
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3.5 sm:px-8">
        <div className="order-1">
          <Marca conFrase />
        </div>
        <Buscador
          categorias={categorias}
          className="order-3 basis-full md:order-2 md:max-w-[760px] md:flex-1 md:basis-auto"
        />
        <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
          {tienda ? (
            <AccionesVendedor tienda={tienda} />
          ) : sesion ? (
            <Link href="/equipo/cuentas" className={`${enlaceFuerte} text-apoyo md:hidden`}>
              Panel del equipo
            </Link>
          ) : (
            <Link
              href="/ingresar"
              className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium no-underline md:hidden"
            >
              Ingresar
            </Link>
          )}
        </div>
      </div>

      {completa && (
        <Suspense fallback={<div className="h-12 bg-tinta" />}>
          <BandaCategorias categorias={categorias} />
        </Suspense>
      )}
      {completa && (
        <div className="bg-pase-suave text-nota font-semibold text-tinta max-md:hidden">
          <div className="mx-auto flex min-h-[34px] max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 sm:px-8">
            {VENTAJAS.map((ventaja, indice) => (
              <span key={ventaja} className="flex items-center gap-4">
                {indice > 0 && <span aria-hidden="true">·</span>}
                {ventaja}
              </span>
            ))}
          </div>
        </div>
      )}
      {!completa && <div className="border-b border-linea" />}
    </header>
  );
}
