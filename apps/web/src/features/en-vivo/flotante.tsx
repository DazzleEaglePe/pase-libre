'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Miniatura } from '@/shared/ui/miniatura';

import { useAhora, useEnVivo } from './datos';
import { EtiquetaTipo, FilaEnVivo, PildoraEnVivo, botonResponder } from './piezas';
import { BotonResponder } from './responder';
import { cuantoQueda, lineaLugar, type ItemEnVivo } from './textos';

type Estado = 'abierta' | 'mini' | 'cerrada';

/** Lo que recuerda el navegador (como las búsquedas recientes): nada viaja a la API. */
const CLAVE = 'paselibre:en-vivo';
/** Cuánto se queda cada publicación en la tarjeta mini. */
const DURACION = 5_000;
const PASO = 100;
/** Al bajar más que esto, la ventana se encoge sola. */
const UMBRAL = 120;

interface Recuerdo {
  /** El día de Lima en que se vio por última vez. */
  dia: string;
  /** La publicación más nueva que se vio: si llega otra, se vuelve a abrir. */
  visto: string;
  /** Se cerró con ×: queda solo la pastilla hasta el día siguiente. */
  cerrada: boolean;
}

const diaDeLima = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

function leerRecuerdo(): Recuerdo | null {
  try {
    const valor = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Recuerdo | null;
    return valor?.dia === diaDeLima() ? valor : null;
  } catch {
    return null;
  }
}

function guardarRecuerdo(cambios: Partial<Recuerdo>): void {
  try {
    const actual = leerRecuerdo() ?? { dia: diaDeLima(), visto: '', cerrada: false };
    localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...cambios, dia: diaDeLima() }));
  } catch {
    // Navegación privada o almacenamiento lleno: sin recuerdo, se abre cada vez.
  }
}

/** Solo en el catálogo: portada, búsqueda y ficha (docs/09 §3.8). */
const enElCatalogo = (ruta: string) =>
  ruta === '/' || ruta.startsWith('/buscar') || ruta.startsWith('/p/');

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONOS = {
  minimizar: <path d="M7 7l10 10M17 9v8H9" />,
  abrir: <path d="M17 17L7 7M7 15V7h8" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  abajo: <path d="M6 9l6 6 6-6" />,
  pausa: <path d="M9 6v12M15 6v12" />,
  seguir: <path d="M8 5.5v13l10-6.5z" />,
  anterior: <path d="M15 6l-6 6 6 6" />,
  siguiente: <path d="M9 6l6 6-6 6" />,
};

function BotonIcono({
  etiqueta,
  icono,
  alPulsar,
  chico = false,
}: {
  etiqueta: string;
  icono: keyof typeof ICONOS;
  alPulsar: () => void;
  chico?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={alPulsar}
      className={`flex shrink-0 items-center justify-center rounded-full text-tinta hover:bg-superficie ${
        chico ? 'h-8 w-8' : 'h-10 w-10'
      }`}
    >
      <Icono>{ICONOS[icono]}</Icono>
    </button>
  );
}

/**
 * En vivo, propuesta E del lienzo (D-53, RF-25 y RF-74). Al entrar, una ventana flotante
 * bajo el saludo; al bajar, una tarjeta mini en la esquina que pasa una publicación cada
 * 5 s y sigue al usuario; cerrada, la pastilla «En vivo · N». En el celular son una hoja
 * desde abajo y una barra flotante.
 *
 * - Se abre sola una vez al día, o cuando hay algo nuevo desde la última vez.
 * - Si se encogió sola al bajar, vuelve a abrirse arriba del todo; si se minimizó o se
 *   cerró a mano, se respeta.
 * - Se detiene con el mouse encima, con el foco o con pausa; con «reducir movimiento» no
 *   pasa sola. Nunca suena.
 * - En el celular, sin sesión, empieza en la barra: no tapa lo que llega desde Google.
 */
export function EnVivoFlotante({ conSesion }: { conSesion: boolean }) {
  const ruta = usePathname();
  const { datos, activo } = useEnVivo();
  const ahora = useAhora();
  const [estado, setEstado] = useState<Estado | null>(null);
  const porScroll = useRef(false);

  const items = datos?.en_vivo ?? [];
  const masNuevo = items.reduce((max, item) => (item.creado_en > max ? item.creado_en : max), '');

  // La primera vez que llegan datos se decide cómo empieza.
  useEffect(() => {
    if (estado !== null || items.length === 0) return;
    const recuerdo = leerRecuerdo();
    const movil = !window.matchMedia('(min-width: 768px)').matches;
    let inicial: Estado = 'abierta';
    if (recuerdo?.cerrada) inicial = 'cerrada';
    else if (recuerdo && recuerdo.visto >= masNuevo) inicial = 'mini';
    else if ((movil && !conSesion) || window.scrollY > UMBRAL) inicial = 'mini';
    setEstado(inicial);
    guardarRecuerdo({ visto: masNuevo });
  }, [estado, items.length, masNuevo, conSesion]);

  // Al bajar se encoge; si fue por bajar, arriba del todo se vuelve a abrir.
  useEffect(() => {
    if (estado === null || estado === 'cerrada') return;
    const alMover = () => {
      if (estado === 'abierta' && window.scrollY > UMBRAL) {
        porScroll.current = true;
        setEstado('mini');
      } else if (estado === 'mini' && porScroll.current && window.scrollY < 16) {
        porScroll.current = false;
        setEstado('abierta');
      }
    };
    window.addEventListener('scroll', alMover, { passive: true });
    return () => window.removeEventListener('scroll', alMover);
  }, [estado]);

  const minimizar = useCallback(() => {
    porScroll.current = false;
    setEstado('mini');
  }, []);
  const cerrar = useCallback(() => {
    porScroll.current = false;
    setEstado('cerrada');
    guardarRecuerdo({ cerrada: true });
  }, []);
  const abrir = useCallback(() => {
    porScroll.current = false;
    setEstado('abierta');
    guardarRecuerdo({ cerrada: false, visto: masNuevo });
  }, [masNuevo]);

  if (!activo || !enElCatalogo(ruta) || items.length === 0 || estado === null) return null;

  if (estado === 'cerrada') {
    return (
      <button
        type="button"
        onClick={abrir}
        className="fixed bottom-4 right-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-borde bg-white px-4 text-apoyo font-semibold shadow-[0_8px_24px_rgba(10,22,51,0.14)] md:bottom-6 md:right-6"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#C8331F]" />
        En vivo · {items.length}
      </button>
    );
  }

  if (estado === 'abierta') {
    return (
      <Ventana
        items={items}
        ahora={ahora}
        conSesion={conSesion}
        alMinimizar={minimizar}
        alCerrar={cerrar}
      />
    );
  }

  return <Mini items={items} ahora={ahora} alAbrir={abrir} alCerrar={cerrar} />;
}

function PieVentana({ conSesion }: { conSesion: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-linea pt-3">
      <Link href="/en-vivo" className="text-apoyo font-semibold">
        Ver todo
      </Link>
      <Link
        href={conSesion ? '/en-vivo/publicar' : '/ingresar'}
        className="inline-flex h-11 items-center rounded-full border border-borde bg-white px-5 text-apoyo font-semibold no-underline"
      >
        Publicar en vivo
      </Link>
    </div>
  );
}

/** Al entrar: la ventana flotante (computadora) o la hoja desde abajo (celular). */
function Ventana({
  items,
  ahora,
  conSesion,
  alMinimizar,
  alCerrar,
}: {
  items: ItemEnVivo[];
  ahora: number;
  conSesion: boolean;
  alMinimizar: () => void;
  alCerrar: () => void;
}) {
  const lista = (
    <ul className="flex flex-col">
      {items.map((item) => (
        <FilaEnVivo key={item.id} item={item} ahora={ahora} />
      ))}
    </ul>
  );
  const cabecera = (abajo: boolean) => (
    <div className="flex items-center justify-between gap-2 pb-1.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <PildoraEnVivo />
        <h2 className="truncate text-tarjeta">Busco y ofertas flash</h2>
      </span>
      <span className="flex">
        <BotonIcono
          etiqueta="Minimizar"
          icono={abajo ? 'abajo' : 'minimizar'}
          alPulsar={alMinimizar}
        />
        <BotonIcono etiqueta="Cerrar" icono="cerrar" alPulsar={alCerrar} />
      </span>
    </div>
  );
  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape') alMinimizar();
  };

  return (
    <>
      <aside
        aria-label="En vivo: busco y ofertas flash"
        onKeyDown={alTeclear}
        className="fixed right-6 top-[304px] z-30 hidden max-h-[calc(100dvh-328px)] w-[404px] flex-col overflow-y-auto rounded-2xl border border-linea bg-white px-5 pb-4 pt-3 shadow-[0_18px_48px_rgba(10,22,51,0.18),0_2px_6px_rgba(10,22,51,0.08)] motion-safe:animate-[entrar-en-vivo_280ms_ease-out] md:flex"
      >
        {cabecera(false)}
        {lista}
        <PieVentana conSesion={conSesion} />
      </aside>
      <section
        aria-label="En vivo: busco y ofertas flash"
        onKeyDown={alTeclear}
        className="fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col overflow-y-auto rounded-t-[20px] bg-white px-4 pb-5 pt-2 shadow-[0_-12px_40px_rgba(10,22,51,0.2)] motion-safe:animate-[subir-en-vivo_300ms_ease-out] md:hidden"
      >
        <span aria-hidden="true" className="mb-1.5 h-1 w-10 self-center rounded-full bg-borde" />
        {cabecera(true)}
        {lista}
        <PieVentana conSesion={conSesion} />
      </section>
    </>
  );
}

/**
 * Al bajar: una publicación a la vez. La pista lleva una copia de la primera al final;
 * al llegar a ella salta al inicio sin animar, así la vuelta no se nota.
 */
function Mini({
  items,
  ahora,
  alAbrir,
  alCerrar,
}: {
  items: ItemEnVivo[];
  ahora: number;
  alAbrir: () => void;
  alCerrar: () => void;
}) {
  const n = items.length;
  const [indice, setIndice] = useState(0);
  const [saltando, setSaltando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [encima, setEncima] = useState(false);
  const [reducir, setReducir] = useState(false);
  const indiceActual = useRef(0);
  const progresoActual = useRef(0);
  const salto = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setReducir(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return () => clearTimeout(salto.current);
  }, []);

  const irA = useCallback((valor: number, sinAnimar: boolean) => {
    indiceActual.current = valor;
    setSaltando(sinAnimar);
    setIndice(valor);
  }, []);

  // Si cambia la lista (llegó una, se cerró otra), se vuelve a la primera.
  useEffect(() => {
    clearTimeout(salto.current);
    progresoActual.current = 0;
    setProgreso(0);
    irA(0, true);
  }, [n, irA]);

  const mover = useCallback(
    (paso: 1 | -1) => {
      clearTimeout(salto.current);
      progresoActual.current = 0;
      setProgreso(0);
      const actual = indiceActual.current % n;
      if (paso < 0 && actual === 0) {
        // Hacia atrás desde la primera: salta a la copia y anima hacia la última.
        irA(n, true);
        salto.current = setTimeout(() => irA(n - 1, false), 40);
        return;
      }
      const siguiente = actual + paso;
      irA(siguiente, false);
      if (siguiente === n) salto.current = setTimeout(() => irA(0, true), 480);
    },
    [n, irA],
  );

  const quieta = pausa || encima || reducir || n < 2;
  useEffect(() => {
    if (quieta) return;
    const reloj = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      progresoActual.current += PASO / DURACION;
      if (progresoActual.current >= 1) mover(1);
      else setProgreso(progresoActual.current);
    }, PASO);
    return () => clearInterval(reloj);
  }, [quieta, mover]);

  const pista = n > 1 ? [...items, items[0] as ItemEnVivo] : items;
  const actual = indice % n;
  const deslizar = {
    transform: `translateX(-${indice * 100}%)`,
    transition: saltando ? 'none' : 'transform 450ms ease',
  };
  const controles = {
    onMouseEnter: () => setEncima(true),
    onMouseLeave: () => setEncima(false),
    onFocus: () => setEncima(true),
    onBlur: () => setEncima(false),
    onKeyDown: (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    },
  };
  const barraDeTiempo = (
    <span aria-hidden="true" className="block h-[3px] bg-linea">
      <span className="block h-[3px] bg-pase" style={{ width: `${Math.round(progreso * 100)}%` }} />
    </span>
  );

  return (
    <>
      {/* Computadora: la tarjeta mini en la esquina (EV_SigueE). */}
      <aside
        aria-label="En vivo: busco y ofertas flash"
        {...controles}
        className="fixed bottom-6 right-6 z-30 hidden w-[422px] flex-col overflow-hidden rounded-2xl border border-linea bg-white shadow-[0_18px_48px_rgba(10,22,51,0.18),0_2px_6px_rgba(10,22,51,0.08)] motion-safe:animate-[entrar-en-vivo_280ms_ease-out] md:flex"
      >
        <div className="flex items-center justify-between gap-1 pl-3 pr-2 pt-2">
          <span className="flex items-center gap-0.5">
            <PildoraEnVivo />
            {n > 1 && (
              <>
                <span className="ml-1.5">
                  <BotonIcono
                    etiqueta="Anterior"
                    icono="anterior"
                    alPulsar={() => mover(-1)}
                    chico
                  />
                </span>
                <span className="min-w-12 text-center text-nota text-detalle">
                  {actual + 1} de {n}
                </span>
                <BotonIcono
                  etiqueta="Siguiente"
                  icono="siguiente"
                  alPulsar={() => mover(1)}
                  chico
                />
              </>
            )}
          </span>
          <span className="flex">
            {n > 1 && !reducir && (
              <BotonIcono
                etiqueta={pausa ? 'Seguir pasando' : 'Pausar'}
                icono={pausa ? 'seguir' : 'pausa'}
                alPulsar={() => setPausa((p) => !p)}
              />
            )}
            <BotonIcono etiqueta="Abrir la ventana" icono="abrir" alPulsar={alAbrir} />
            <BotonIcono etiqueta="Cerrar" icono="cerrar" alPulsar={alCerrar} />
          </span>
        </div>
        <div className="overflow-hidden pb-3 pt-2">
          <div className="flex" style={deslizar}>
            {pista.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                className="flex w-full shrink-0 items-center gap-3 px-3"
                inert={i !== indice}
              >
                <Miniatura
                  ruta={item.producto?.foto ?? null}
                  categoria={item.categoria.slug}
                  className="h-14 w-16 rounded-[10px]"
                  glifo={44}
                  grosor={4.5}
                />
                <Link
                  href={`/en-vivo?id=${item.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 no-underline"
                >
                  <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                    <EtiquetaTipo tipo={item.tipo} />
                    <span className="text-nota font-semibold text-aviso">
                      {cuantoQueda(item.vence_en, ahora)}
                    </span>
                  </span>
                  <b className="truncate text-cuerpo font-semibold">{item.titulo}</b>
                  <span className="truncate text-nota text-detalle">{lineaLugar(item)}</span>
                </Link>
                <BotonResponder item={item} className={botonResponder} />
              </div>
            ))}
          </div>
        </div>
        {barraDeTiempo}
      </aside>

      {/* Celular: la barra flotante abajo (EV_SigueMovilBajar). */}
      <aside
        aria-label="En vivo: busco y ofertas flash"
        {...controles}
        className="fixed inset-x-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-linea bg-white shadow-[0_12px_32px_rgba(10,22,51,0.22)] motion-safe:animate-[subir-en-vivo_300ms_ease-out] md:hidden"
      >
        <div className="flex items-center gap-1 py-2.5 pl-2.5 pr-1.5">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex" style={deslizar}>
              {pista.map((item, i) => (
                <div
                  key={`${item.id}-${i}`}
                  className="flex w-full shrink-0 items-center gap-2.5 pr-1.5"
                  inert={i !== indice}
                >
                  <button
                    type="button"
                    onClick={alAbrir}
                    aria-label="Abrir En vivo"
                    className="relative shrink-0"
                  >
                    <Miniatura
                      ruta={item.producto?.foto ?? null}
                      categoria={item.categoria.slug}
                      className="h-11 w-12 rounded-[10px]"
                      glifo={32}
                      grosor={5}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute left-1 top-1 h-2 w-2 rounded-full bg-[#C8331F] ring-2 ring-superficie"
                    />
                  </button>
                  <Link
                    href={`/en-vivo?id=${item.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 no-underline"
                  >
                    <span className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                      <EtiquetaTipo tipo={item.tipo} />
                      <span className="text-nota font-semibold text-aviso">
                        {cuantoQueda(item.vence_en, ahora, true)}
                      </span>
                    </span>
                    <b className="truncate text-apoyo font-semibold">{item.titulo}</b>
                  </Link>
                  <BotonResponder item={item} className={`${botonResponder} h-10`} />
                </div>
              ))}
            </div>
          </div>
          <BotonIcono etiqueta="Cerrar" icono="cerrar" alPulsar={alCerrar} />
        </div>
        {barraDeTiempo}
      </aside>
    </>
  );
}
