'use client';

import type {
  CategoriaResumen,
  Contadores,
  RespuestaBarra,
  RespuestaYo,
  TiendaDeSesion,
} from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { useEnVivoMontado } from '@/features/en-vivo/contexto';

import { Buscador } from './buscador';
import { Campanita, Insignia, useContadores } from './campanita';
import { Marca } from './marca';
import { MenuCategorias } from './menu-categorias';
import { MenuCuenta } from './menu-cuenta';

/** Los numeritos de la barra: los de Pedidos en vivo salen del contexto, el resto de `/barra`. */
export interface NumerosBarra {
  /** Nulo con Pedidos en vivo apagado (`EN_VIVO`): sus entradas no se muestran. */
  enVivo: number | null;
  remates: number | null;
  recienHoy: number;
}

function useNumeros(barra: RespuestaBarra | null): NumerosBarra {
  const compartido = useEnVivoMontado();
  // Encendido según el servidor: las entradas se dibujan desde el primer momento y el número
  // llega cuando carga la lista (sin que la banda salte).
  const encendido = (barra?.en_vivo ?? false) && compartido?.activo !== false;
  const lista = compartido?.datos?.en_vivo ?? [];
  return {
    enVivo: encendido ? lista.length : null,
    remates: encendido ? lista.filter((pedido) => pedido.tipo === 'FLASH').length : null,
    recienHoy: barra?.recien_hoy ?? 0,
  };
}

const iconoCategorias = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <rect x="14" y="14" width="6" height="6" rx="1" />
  </svg>
);

const iconoRemate = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </svg>
);

const iconoEstrella = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M12 3l2.4 5.6L20 9.3l-4.3 3.9 1.2 5.8L12 16l-4.9 3 1.2-5.8L4 9.3l5.6-.7z" />
  </svg>
);

const puntoVivo = (
  <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-latido rounded-full bg-vivo" />
);

/** La insignia de un enlace de la banda: naranja (en vivo), ámbar (remates) o verde (nuevos). */
function Cuenta({ tono, children }: { tono: 'contador' | 'ambar' | 'verde'; children: ReactNode }) {
  const clase =
    tono === 'contador'
      ? 'bg-contador text-tinta'
      : tono === 'ambar'
        ? 'bg-ambar text-ambar-texto'
        : 'bg-pase-medio text-marca';
  return (
    <span className={`rounded-full px-[7px] text-[11px] font-bold leading-[18px] ${clase}`}>
      {children}
    </span>
  );
}

/**
 * La banda oscura de la computadora (D_Barra): «Todas las categorías» abre su menú; después
 * Pedidos en vivo, los remates y lo recién llegado, cada uno con su numerito; «Ayuda» a la
 * derecha.
 */
function BandaComputadora({
  categorias,
  barra,
  numeros,
  conTienda,
}: {
  categorias: CategoriaResumen[];
  barra: RespuestaBarra | null;
  numeros: NumerosBarra;
  conTienda: boolean;
}) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const enVivo = ruta === '/pedidos-en-vivo';
  const remates = enVivo && parametros.get('tipo') === 'remato';
  const recientes = ruta === '/buscar' && parametros.get('orden') === 'recientes';

  const clase = (activa: boolean) =>
    `flex h-[46px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-apoyo font-semibold text-white no-underline ${
      activa ? 'border-acento' : 'border-transparent hover:border-white/40'
    }`;

  return (
    <nav aria-label="Navegación" className="bg-tinta max-md:hidden">
      <div className="mx-auto flex max-w-[1280px] items-center overflow-x-auto px-5 [scrollbar-width:none]">
        <MenuCategorias
          categorias={categorias}
          barra={barra}
          conSesion={conTienda}
          claseBoton={clase}
          icono={iconoCategorias}
        />
        {numeros.enVivo !== null && (
          <Link
            href="/pedidos-en-vivo"
            aria-current={enVivo && !remates ? 'page' : undefined}
            className={clase(enVivo && !remates)}
          >
            {puntoVivo}
            Pedidos en vivo
            {numeros.enVivo > 0 && <Cuenta tono="contador">{numeros.enVivo}</Cuenta>}
          </Link>
        )}
        <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-linea-oscura" />
        {numeros.remates !== null && (
          <Link
            href="/pedidos-en-vivo?tipo=remato"
            aria-current={remates ? 'page' : undefined}
            className={clase(remates)}
          >
            {iconoRemate}
            Remates de hoy
            {numeros.remates > 0 && <Cuenta tono="ambar">{numeros.remates}</Cuenta>}
          </Link>
        )}
        <Link
          href="/buscar?orden=recientes"
          aria-current={recientes ? 'page' : undefined}
          className={clase(recientes)}
        >
          {iconoEstrella}
          Recién llegados
          {numeros.recienHoy > 0 && <Cuenta tono="verde">+{numeros.recienHoy} hoy</Cuenta>}
        </Link>
        <Link
          href="/ayuda"
          aria-current={ruta === '/ayuda' ? 'page' : undefined}
          className={`${clase(ruta === '/ayuda')} ml-auto !text-acento`}
        >
          Ayuda
        </Link>
      </div>
    </nav>
  );
}

/**
 * Las burbujas del celular (NAVB_CelB): se deslizan hacia el costado. «En vivo» va en negro,
 * para que se note primero.
 */
function BurbujasCelular({ numeros }: { numeros: NumerosBarra }) {
  const ruta = usePathname();
  const burbuja =
    'flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-apoyo font-semibold no-underline';
  const clara = `${burbuja} border-borde bg-white text-tinta`;
  return (
    <nav aria-label="Navegación" className="border-b border-linea bg-white md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        <Link
          href="/categorias"
          aria-current={ruta === '/categorias' ? 'page' : undefined}
          className={clara}
        >
          {iconoCategorias}
          Categorías
        </Link>
        {numeros.enVivo !== null && (
          <Link href="/pedidos-en-vivo" className={`${burbuja} border-tinta bg-tinta text-white`}>
            {puntoVivo}
            En vivo
            {numeros.enVivo > 0 && <Cuenta tono="contador">{numeros.enVivo}</Cuenta>}
          </Link>
        )}
        {numeros.remates !== null && (
          <Link href="/pedidos-en-vivo?tipo=remato" className={clara}>
            {iconoRemate}
            Remates
            {numeros.remates > 0 && <Cuenta tono="ambar">{numeros.remates}</Cuenta>}
          </Link>
        )}
        <Link href="/buscar?orden=recientes" className={clara}>
          {iconoEstrella}
          Recién llegados
          {numeros.recienHoy > 0 && <Cuenta tono="verde">+{numeros.recienHoy}</Cuenta>}
        </Link>
      </div>
    </nav>
  );
}

/** Lo de la derecha de la fila verde con tienda: Publicar, Mensajes, la campanita y la cuenta. */
function AccionesTienda({
  tienda,
  contadores,
}: {
  tienda: TiendaDeSesion;
  contadores: Contadores;
}) {
  const ruta = usePathname();
  const enMensajes = ruta.startsWith('/mensajes');
  const lugar = [tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/publicar"
        className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-apoyo font-semibold text-marca no-underline hover:bg-pase-suave max-md:hidden"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Publicar
      </Link>
      <Link
        href="/mensajes"
        aria-label={
          contadores.mensajes > 0 ? `Mensajes, ${contadores.mensajes} sin leer` : 'Mensajes'
        }
        aria-current={enMensajes ? 'page' : undefined}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white max-md:hidden ${
          enMensajes ? 'bg-white/15' : 'hover:bg-white/15'
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        <Insignia cantidad={contadores.mensajes} />
      </Link>
      <Campanita sinLeer={contadores.avisos} sobreMarca />
      <div className="max-md:hidden">
        <MenuCuenta tienda={tienda} lugar={lugar} sobreMarca />
      </div>
    </div>
  );
}

function ConTienda({
  tienda,
  children,
}: {
  tienda: TiendaDeSesion;
  children: (acciones: ReactNode) => ReactNode;
}) {
  const contadores = useContadores();
  return children(<AccionesTienda tienda={tienda} contadores={contadores} />);
}

/**
 * La barra de todas las páginas (D_Barra del lienzo final). Arriba, en el verde de la marca,
 * el logo con su frase, el buscador y la cuenta. Abajo, en la computadora, la banda oscura con
 * «Todas las categorías» y los numeritos; en el celular, las burbujas que se deslizan
 * (NAVB_CelB). Toda la barra se queda fija al bajar; en el celular la fila del logo se va y
 * quedan el buscador y las burbujas, para no gastar un cuarto de la pantalla.
 */
export function Cabecera({
  sesion,
  categorias,
  barra,
}: {
  sesion: RespuestaYo | null;
  categorias: CategoriaResumen[];
  barra: RespuestaBarra | null;
}) {
  const tienda = sesion?.tienda ?? null;
  const numeros = useNumeros(barra);
  const ruta = usePathname();
  // En Mensajes el chat necesita el alto: sin las burbujas en el celular.
  const enMensajes = ruta.startsWith('/mensajes');
  // Pantallas con su propia cabecera en el celular: «Todas las categorías» (CAT_Cel1), los
  // resultados (M_Resultados), la ficha (M_Ficha), Mis publicaciones (MP_Cel) y el historial
  // (HI_A2_Cel).
  const propia =
    ruta === '/categorias' ||
    ruta === '/buscar' ||
    ruta === '/mis-publicaciones' ||
    ruta === '/historial' ||
    ruta.startsWith('/p/') ||
    ruta.startsWith('/tiendas/');

  const armar = (acciones: ReactNode) => (
    <header className={`sticky top-0 z-30 max-md:-top-[66px] ${propia ? 'max-md:hidden' : ''}`}>
      <div className="relative bg-marca text-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-7 gap-y-3 px-4 py-3.5 sm:px-8 md:flex-nowrap">
          <div className="order-1 shrink-0">
            <Marca sobreMarca conFrase />
          </div>
          <Buscador
            sobreMarca
            className="order-3 basis-full md:order-2 md:min-w-0 md:flex-1 md:basis-auto"
          />
          <div className="order-2 ml-auto flex items-center gap-1.5 md:order-3">
            {acciones ?? (sesion ? <AccionesEquipo /> : <BotonIngresar />)}
          </div>
        </div>
      </div>
      <Suspense fallback={<div className="h-[46px] bg-tinta max-md:hidden" />}>
        <BandaComputadora
          categorias={categorias}
          barra={barra}
          numeros={numeros}
          conTienda={Boolean(tienda)}
        />
      </Suspense>
      {!enMensajes && <BurbujasCelular numeros={numeros} />}
    </header>
  );

  return tienda ? <ConTienda tienda={tienda}>{armar}</ConTienda> : armar(null);
}

function BotonIngresar() {
  return (
    <Link
      href="/ingresar"
      className="flex h-11 items-center rounded-full bg-white px-[22px] text-cuerpo font-semibold text-marca no-underline hover:bg-pase-suave max-md:h-10 max-md:px-4 max-md:text-apoyo"
    >
      Iniciar sesión
    </Link>
  );
}

/** Las cuentas del equipo no tienen tienda: su panel y salir. */
function AccionesEquipo() {
  return (
    <>
      <Link
        href="/equipo"
        className="flex h-10 items-center rounded-full bg-white px-4 text-apoyo font-semibold text-marca no-underline hover:bg-pase-suave"
      >
        Panel del equipo
      </Link>
      <span className="text-white max-md:hidden [&_button]:text-white">
        <BotonSalir />
      </span>
    </>
  );
}
