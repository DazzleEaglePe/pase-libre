'use client';

import {
  IconArrowsDiagonal,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';

import { useEnVivoCompartido } from './contexto';
import { useAhora } from './datos';
import { EtiquetaTipo, FilaEnVivo, PildoraEnVivo, botonResponder } from './piezas';
import { BotonResponder } from './responder';
import { cuantoQueda, lineaLugar, type ItemEnVivo } from './textos';

type Estado = 'abierta' | 'mini' | 'oculta';

/** Lo que recuerda el navegador (como las búsquedas recientes): nada viaja a la API. */
const CLAVE = 'paselibre:en-vivo';
/** Cuánto se queda cada publicación en la tarjeta mini. */
const DURACION = 5_000;
const PASO = 100;
/** Al bajar más que esto, la ventana se encoge sola. */
const UMBRAL = 120;

interface Recuerdo {
  /** El día de Lima: al día siguiente se olvida todo y la ventana vuelve a abrirse una vez. */
  dia: string;
  /** La publicación más nueva que se vio: si llega otra, la tarjeta mini vuelve a salir. */
  visto: string;
  /** Cómo la dejó: encogida en la esquina u oculta hasta que haya algo nuevo. */
  estado: 'mini' | 'oculta' | null;
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
    const actual = leerRecuerdo() ?? { dia: diaDeLima(), visto: '', estado: null };
    localStorage.setItem(CLAVE, JSON.stringify({ ...actual, ...cambios, dia: diaDeLima() }));
  } catch {
    // Navegación privada o almacenamiento lleno: sin recuerdo, se abre cada vez.
  }
}

/** Solo en el catálogo: portada, búsqueda y ficha (docs/09 §3.8). */
const enElCatalogo = (ruta: string) =>
  ruta === '/' || ruta.startsWith('/buscar') || ruta.startsWith('/p/');

/** Íconos de línea de Tabler, con el trazo de la marca (docs/10 §5). */
const ICONOS = {
  abrir: IconArrowsDiagonal,
  cerrar: IconX,
  pausa: IconPlayerPause,
  seguir: IconPlayerPlay,
  anterior: IconChevronLeft,
  siguiente: IconChevronRight,
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
  const Dibujo = ICONOS[icono];
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
      <Dibujo size={chico ? 18 : 20} stroke={1.5} aria-hidden="true" />
    </button>
  );
}

/**
 * En vivo, propuesta E del lienzo (D-53, RF-25 y RF-74). Al entrar, una ventana flotante
 * bajo el saludo; al bajar o con su ×, una tarjeta mini en la esquina que pasa una
 * publicación cada 5 s y sigue al usuario. En el celular son una hoja desde abajo y una
 * barra flotante. La entrada fija está en la banda de categorías.
 *
 * - La ventana completa se abre sola una vez al día. Después, en cualquier página o
 *   pestaña, empieza en la tarjeta mini: el estado se guarda en el navegador.
 * - La × de la tarjeta mini la oculta hasta que alguien publique algo nuevo.
 * - Se detiene con el mouse encima, con el foco o con pausa; con «reducir movimiento» no
 *   pasa sola. Nunca suena.
 * - En el celular, sin sesión, empieza en la barra: no tapa lo que llega desde Google.
 */
export function EnVivoFlotante({ conSesion }: { conSesion: boolean }) {
  const ruta = usePathname();
  const compartido = useEnVivoCompartido();
  const ahora = useAhora();
  const [estado, setEstado] = useState<Estado | null>(null);
  const decidido = useRef(false);

  const items = compartido?.datos?.en_vivo ?? [];
  const masNuevo = items.reduce((max, item) => (item.creado_en > max ? item.creado_en : max), '');

  // La primera vez que llegan datos se decide cómo empieza; después, si llega algo nuevo,
  // la tarjeta mini vuelve a salir (nunca la ventana completa).
  useEffect(() => {
    if (items.length === 0) return;
    const recuerdo = leerRecuerdo();
    const hayNuevo = !recuerdo || masNuevo > recuerdo.visto;
    if (!decidido.current) {
      decidido.current = true;
      const movil = !window.matchMedia('(min-width: 768px)').matches;
      let inicial: Estado = 'mini';
      if (!recuerdo)
        inicial = (movil && !conSesion) || window.scrollY > UMBRAL ? 'mini' : 'abierta';
      else if (recuerdo.estado === 'oculta' && !hayNuevo) inicial = 'oculta';
      setEstado(inicial);
      // Desde aquí, el resto del día empieza encogida aunque no la toque.
      guardarRecuerdo({ visto: masNuevo, estado: inicial === 'oculta' ? 'oculta' : 'mini' });
      return;
    }
    if (hayNuevo) {
      guardarRecuerdo({ visto: masNuevo, estado: 'mini' });
      setEstado((actual) => (actual === 'oculta' ? 'mini' : actual));
    }
  }, [items.length, masNuevo, conSesion]);

  // Otra pestaña la encogió u ocultó: esta hace lo mismo.
  useEffect(() => {
    const alCambiar = (evento: StorageEvent) => {
      if (evento.key !== CLAVE) return;
      const recuerdo = leerRecuerdo();
      if (recuerdo?.estado) setEstado((actual) => (actual === null ? actual : recuerdo.estado));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  // Al bajar se encoge, y se queda encogida: no vuelve a abrirse al subir ni al cambiar de
  // página.
  useEffect(() => {
    if (estado !== 'abierta') return;
    const alMover = () => {
      if (window.scrollY > UMBRAL) {
        setEstado('mini');
        guardarRecuerdo({ estado: 'mini' });
      }
    };
    window.addEventListener('scroll', alMover, { passive: true });
    return () => window.removeEventListener('scroll', alMover);
  }, [estado]);

  const encoger = useCallback(() => {
    setEstado('mini');
    guardarRecuerdo({ estado: 'mini' });
  }, []);
  const ocultar = useCallback(() => {
    setEstado('oculta');
    guardarRecuerdo({ estado: 'oculta', visto: masNuevo });
  }, [masNuevo]);
  // Abrirla a mano no cambia lo guardado: en la próxima página vuelve a empezar encogida.
  const abrir = useCallback(() => setEstado('abierta'), []);

  if (!compartido?.activo || !enElCatalogo(ruta) || items.length === 0) return null;
  if (estado === null || estado === 'oculta') return null;

  if (estado === 'abierta') {
    return <Ventana items={items} ahora={ahora} conSesion={conSesion} alCerrar={encoger} />;
  }
  return <Mini items={items} ahora={ahora} alAbrir={abrir} alCerrar={ocultar} />;
}

function PieVentana({ conSesion }: { conSesion: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-linea pt-3">
      <Link href="/pases-del-dia" className="text-apoyo font-semibold">
        Ver todo
      </Link>
      <Link
        href={conSesion ? '/pases-del-dia/publicar' : '/ingresar'}
        className="inline-flex h-11 items-center rounded-full border border-borde bg-white px-5 text-apoyo font-semibold no-underline"
      >
        Publicar busco o remate
      </Link>
    </div>
  );
}

/** Al entrar: la ventana flotante (computadora) o la hoja desde abajo (celular). */
function Ventana({
  items,
  ahora,
  conSesion,
  alCerrar,
}: {
  items: ItemEnVivo[];
  ahora: number;
  conSesion: boolean;
  /** La × la encoge a la tarjeta mini, igual que bajar. */
  alCerrar: () => void;
}) {
  const lista = (
    <ul className="flex flex-col">
      {items.map((item) => (
        <FilaEnVivo key={item.id} item={item} ahora={ahora} />
      ))}
    </ul>
  );
  const cabecera = (
    <div className="flex items-center justify-between gap-2 pb-1.5">
      <span className="flex min-w-0 items-center gap-2.5">
        <PildoraEnVivo />
        <h2 className="truncate text-tarjeta">Busco y remates</h2>
      </span>
      <BotonIcono etiqueta="Cerrar (queda en la esquina)" icono="cerrar" alPulsar={alCerrar} />
    </div>
  );
  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === 'Escape') alCerrar();
  };

  return (
    <>
      <aside
        aria-label="Pases del día: busco y remates"
        onKeyDown={alTeclear}
        className="fixed right-6 top-[304px] z-30 hidden max-h-[calc(100dvh-328px)] w-[404px] flex-col overflow-y-auto rounded-2xl border border-linea bg-white px-5 pb-4 pt-3 shadow-[0_18px_48px_rgba(10,22,51,0.18),0_2px_6px_rgba(10,22,51,0.08)] motion-safe:animate-[entrar-en-vivo_280ms_ease-out] md:flex"
      >
        {cabecera}
        {lista}
        <PieVentana conSesion={conSesion} />
      </aside>
      <section
        aria-label="Pases del día: busco y remates"
        onKeyDown={alTeclear}
        className="fixed inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col overflow-y-auto rounded-t-[20px] bg-white px-4 pb-5 pt-2 shadow-[0_-12px_40px_rgba(10,22,51,0.2)] motion-safe:animate-[subir-en-vivo_300ms_ease-out] md:hidden"
      >
        <span aria-hidden="true" className="mb-1.5 h-1 w-10 self-center rounded-full bg-borde" />
        {cabecera}
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
  const [pausa, setPausa] = useState(false);
  const [encima, setEncima] = useState(false);
  const [reducir, setReducir] = useState(false);
  // Cuánto del pie se ve: la tarjeta sube para no tapar Contacto ni las redes.
  const [sobrePie, setSobrePie] = useState(0);

  useEffect(() => {
    const medir = () => {
      const pie = document.querySelector('footer');
      if (!pie) return;
      setSobrePie(Math.max(0, Math.round(window.innerHeight - pie.getBoundingClientRect().top)));
    };
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, []);
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
    irA(0, true);
  }, [n, irA]);

  const mover = useCallback(
    (paso: 1 | -1) => {
      clearTimeout(salto.current);
      progresoActual.current = 0;
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

  return (
    <>
      {/* Computadora: la tarjeta mini en la esquina (EV_SigueE). */}
      <aside
        aria-label="Pases del día: busco y remates"
        {...controles}
        style={{ bottom: 24 + sobrePie }}
        className="borde-en-vivo fixed bottom-6 right-6 z-30 hidden w-[422px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_18px_48px_rgba(10,22,51,0.18),0_2px_6px_rgba(10,22,51,0.08)] motion-safe:animate-[entrar-en-vivo_280ms_ease-out] md:flex"
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
            <BotonIcono
              etiqueta="Ocultar hasta que haya algo nuevo"
              icono="cerrar"
              alPulsar={alCerrar}
            />
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
                  href={`/pases-del-dia?id=${item.id}`}
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
      </aside>

      {/* Celular: la barra flotante abajo (EV_SigueMovilBajar). */}
      <aside
        aria-label="Pases del día: busco y remates"
        {...controles}
        style={{ bottom: 12 + sobrePie }}
        className="borde-en-vivo fixed inset-x-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_rgba(10,22,51,0.22)] motion-safe:animate-[subir-en-vivo_300ms_ease-out] md:hidden"
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
                    aria-label="Abrir Pases del día"
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
                    href={`/pases-del-dia?id=${item.id}`}
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
          <BotonIcono
            etiqueta="Ocultar hasta que haya algo nuevo"
            icono="cerrar"
            alPulsar={alCerrar}
          />
        </div>
      </aside>
    </>
  );
}
