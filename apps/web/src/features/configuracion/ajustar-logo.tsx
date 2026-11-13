'use client';

import { ZOOM_MAXIMO, ZOOM_MINIMO, type AjusteLogo } from '@paselibre/contracts';
import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/** Una imagen elegida (o la original guardada) y sus medidas de verdad. */
export interface ImagenLogo {
  src: string;
  ancho: number;
  alto: number;
}

/** Recién elegida: al centro, sin zoom y con fondo blanco hasta saber el color del borde. */
export const AJUSTE_INICIAL: AjusteLogo = {
  x: 0.5,
  y: 0.5,
  zoom: 1,
  rotacion: 0,
  fondo: '#ffffff',
};

/** Desde qué medida el logo se ve nítido en el perfil (docs/19 §20). */
const LADO_RECOMENDADO = 500;
/** El círculo del editor ocupa 250 de 300 px (P21). */
const PROPORCION_CIRCULO = 250 / 300;
const NEGRO = '#000000';
const BLANCO = '#ffffff';

const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/** El ancho y el alto de la imagen ya girada. */
function girada(imagen: ImagenLogo, rotacion: number): [number, number] {
  return rotacion % 180 === 0 ? [imagen.ancho, imagen.alto] : [imagen.alto, imagen.ancho];
}

/** El zoom de «Que entre entero»: toda la imagen (hasta sus esquinas) cabe en el círculo. */
function zoomEntero(imagen: ImagenLogo, rotacion: number): number {
  const [ancho, alto] = girada(imagen, rotacion);
  // La API no acepta menos de 0,1: una imagen 10 veces más ancha que alta igual entra casi entera.
  return Math.max(0.1, Math.min(ancho, alto) / Math.hypot(ancho, alto));
}

/**
 * Dónde va la imagen para que el círculo de `diametro` px (con su esquina en `desde`) muestre lo
 * que dice el ajuste. Es la misma cuenta con la que la API arma el logo de 512 × 512: el círculo
 * mide `min(ancho, alto) / zoom` de la imagen girada y su centro cae en (`x`, `y`).
 */
function estiloImagen(
  imagen: ImagenLogo,
  ajuste: AjusteLogo,
  diametro: number,
  desde = 0,
): CSSProperties {
  const [ancho, alto] = girada(imagen, ajuste.rotacion);
  const escala = diametro / (Math.min(ancho, alto) / ajuste.zoom);
  const centroX = desde + diametro / 2 + (0.5 - ajuste.x) * ancho * escala;
  const centroY = desde + diametro / 2 + (0.5 - ajuste.y) * alto * escala;
  return {
    position: 'absolute',
    maxWidth: 'none',
    width: imagen.ancho * escala,
    height: imagen.alto * escala,
    left: centroX - (imagen.ancho * escala) / 2,
    top: centroY - (imagen.alto * escala) / 2,
    transform: `rotate(${ajuste.rotacion}deg)`,
  };
}

const CUADRITOS = 'repeating-conic-gradient(#D6DDD9 0% 25%, #fff 0% 50%) 50% / 10px 10px';

const fondoDe = (fondo: string): string => (fondo === 'transparente' ? CUADRITOS : fondo);

/** El logo como queda, en un círculo de `tamano` px: la vista previa de la cabecera, la tarjeta y el perfil. */
export function VistaLogo({
  imagen,
  ajuste,
  tamano,
  className = '',
}: {
  imagen: ImagenLogo;
  ajuste: AjusteLogo;
  tamano: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: tamano, height: tamano, background: fondoDe(ajuste.fondo) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imagen.src} alt="" draggable={false} style={estiloImagen(imagen, ajuste, tamano)} />
    </span>
  );
}

/** Las medidas de una imagen elegida, para la vista previa y los avisos. */
export function leerImagen(archivo: File): Promise<ImagenLogo> {
  return medirImagen(URL.createObjectURL(archivo));
}

export function medirImagen(src: string): Promise<ImagenLogo> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () =>
      resolver({ src, ancho: imagen.naturalWidth || 1, alto: imagen.naturalHeight || 1 });
    imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    imagen.src = src;
  });
}

/** El color del borde de la imagen (el promedio de su contorno), para el fondo. Blanco si no se puede. */
async function colorDelBorde(src: string): Promise<string> {
  try {
    const imagen = new Image();
    imagen.src = src;
    await imagen.decode();
    const lado = 24;
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const contexto = lienzo.getContext('2d', { willReadFrequently: true });
    if (!contexto) return BLANCO;
    contexto.drawImage(imagen, 0, 0, lado, lado);
    const { data } = contexto.getImageData(0, 0, lado, lado);
    let rojo = 0;
    let verde = 0;
    let azul = 0;
    let cuantos = 0;
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        if (x > 0 && y > 0 && x < lado - 1 && y < lado - 1) continue;
        const i = (y * lado + x) * 4;
        // Un borde transparente se ve blanco.
        const alfa = (data[i + 3] ?? 255) / 255;
        rojo += (data[i] ?? 255) * alfa + 255 * (1 - alfa);
        verde += (data[i + 1] ?? 255) * alfa + 255 * (1 - alfa);
        azul += (data[i + 2] ?? 255) * alfa + 255 * (1 - alfa);
        cuantos++;
      }
    }
    const hex = (valor: number) =>
      Math.round(valor / cuantos)
        .toString(16)
        .padStart(2, '0');
    return `#${hex(rojo)}${hex(verde)}${hex(azul)}`;
  } catch {
    return BLANCO;
  }
}

/** «Tu imagen mide 300 × 200…» y «No es cuadrada…»: se avisa, pero se puede seguir igual. */
function avisosDe(imagen: ImagenLogo): string[] {
  const avisos: string[] = [];
  if (imagen.ancho < LADO_RECOMENDADO || imagen.alto < LADO_RECOMENDADO) {
    avisos.push(
      `Tu imagen mide ${imagen.ancho} × ${imagen.alto}: puede verse borrosa. Mejor una de ${LADO_RECOMENDADO} × ${LADO_RECOMENDADO} o más.`,
    );
  }
  if (imagen.ancho !== imagen.alto) {
    avisos.push('No es cuadrada: usa «Que entre entero» para que no se corte nada.');
  }
  return avisos;
}

const botonChico =
  'inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-[11px] text-[12.5px] font-bold';

/**
 * «Ajustar logo» (docs/19 §20, P21): la imagen con el círculo encima y lo de afuera oscurecido; se
 * arrastra para mover (en el celular, con un dedo; acercar o alejar, con dos), la barrita de zoom
 * − ● + (de 1× a 4×), «⊕ Centrar», «↺ Girar», «Que entre entero» y el color de fondo, con la vista
 * previa en vivo de los 3 tamaños (cabecera 28 px, tarjeta y chats 40 px, perfil 96 px). En el
 * celular ocupa toda la pantalla, con «Cancelar» y «Listo» arriba.
 */
export function AjustarLogo({
  imagen,
  ajusteInicial,
  nombre,
  lugar,
  guardando,
  error,
  alGuardar,
  alElegirOtra,
  alCerrar,
}: {
  imagen: ImagenLogo;
  /** Con «Ajustar», el que tenía; con una imagen nueva, nulo. */
  ajusteInicial: AjusteLogo | null;
  /** Para la vista previa: «Corporación NEXUS». */
  nombre: string;
  /** «Cyberplaza · Stand 2B 100». */
  lugar: string;
  guardando: boolean;
  error: string | null;
  alGuardar: (ajuste: AjusteLogo) => void;
  alElegirOtra: () => void;
  alCerrar: () => void;
}) {
  const [ajuste, setAjuste] = useState<AjusteLogo>(ajusteInicial ?? AJUSTE_INICIAL);
  const [delBorde, setDelBorde] = useState<string | null>(null);
  const [lado, setLado] = useState(300);
  const marco = useRef<HTMLDivElement>(null);
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const distancia = useRef<number | null>(null);
  const avisos = avisosDe(imagen);
  const diametro = Math.round(lado * PROPORCION_CIRCULO);
  const borde = (lado - diametro) / 2;
  const minimo = zoomEntero(imagen, ajuste.rotacion);
  const entero = Math.abs(ajuste.zoom - minimo) < 0.005 && ajuste.x === 0.5 && ajuste.y === 0.5;

  // El color del borde de la imagen; con una imagen nueva, es el fondo de entrada.
  useEffect(() => {
    let vigente = true;
    void colorDelBorde(imagen.src).then((color) => {
      if (!vigente) return;
      setDelBorde(color);
      if (!ajusteInicial) setAjuste((actual) => ({ ...actual, fondo: color }));
    });
    return () => {
      vigente = false;
    };
  }, [imagen.src, ajusteInicial]);

  useEffect(() => {
    const elemento = marco.current;
    if (!elemento) return;
    const medir = () => setLado(elemento.clientWidth || 300);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && alCerrar();
    document.addEventListener('keydown', conEscape);
    return () => document.removeEventListener('keydown', conEscape);
  }, [alCerrar]);

  /** Mueve la imagen `dx`, `dy` píxeles de pantalla. */
  function mover(dx: number, dy: number) {
    setAjuste((actual) => {
      const [ancho, alto] = girada(imagen, actual.rotacion);
      const escala = diametro / (Math.min(ancho, alto) / actual.zoom);
      return {
        ...actual,
        x: limitar(actual.x - dx / (ancho * escala), -1, 2),
        y: limitar(actual.y - dy / (alto * escala), -1, 2),
      };
    });
  }

  function acercar(zoom: number) {
    setAjuste((actual) => ({
      ...actual,
      zoom: limitar(zoom, Math.min(ZOOM_MINIMO, zoomEntero(imagen, actual.rotacion)), ZOOM_MAXIMO),
    }));
  }

  /** ↺ Girar 90°: el punto que estaba al centro sigue al centro. */
  function girar() {
    setAjuste((actual) => ({
      ...actual,
      rotacion: ((actual.rotacion + 270) % 360) as AjusteLogo['rotacion'],
      x: actual.y,
      y: 1 - actual.x,
    }));
  }

  const colores: Array<[string, string]> = [
    [BLANCO, 'Blanco'],
    ...(delBorde && delBorde !== BLANCO && delBorde !== NEGRO
      ? ([[delBorde, 'El color del borde de tu imagen']] as Array<[string, string]>)
      : []),
    [NEGRO, 'Negro'],
    ['transparente', 'Transparente'],
  ];

  const vistas = (
    <div className="flex flex-wrap items-end gap-4">
      <span className="flex flex-col items-center gap-1.5">
        <span className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-[#0B7A4B] px-2.5 py-2 text-[11px] font-bold text-white">
          <VistaLogo
            imagen={imagen}
            ajuste={ajuste}
            tamano={28}
            className="border-[1.5px] border-white"
          />
          {nombre.split(' ')[0]?.toUpperCase().slice(0, 10)} ▾
        </span>
        <span className="text-[11.5px] text-[#59645e]">Cabecera</span>
      </span>
      <span className="flex flex-col items-center gap-1.5">
        <span className="flex items-center gap-2 rounded-[10px] border border-[#E3E8E5] bg-white px-2.5 py-2 text-[12px]">
          <VistaLogo imagen={imagen} ajuste={ajuste} tamano={40} />
          <span className="max-w-[140px] leading-[1.3]">
            <b className="block truncate">{nombre}</b>
            <span className="block truncate text-[#59645e]">{lugar}</span>
          </span>
        </span>
        <span className="text-[11.5px] text-[#59645e]">Tarjeta y chats</span>
      </span>
      <span className="flex flex-col items-center gap-1.5">
        <VistaLogo
          imagen={imagen}
          ajuste={ajuste}
          tamano={96}
          className="border-4 border-white shadow-[0_2px_10px_rgba(15,20,18,0.2)]"
        />
        <span className="text-[11.5px] text-[#59645e]">Perfil</span>
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[rgba(15,20,18,0.45)] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-ajustar-logo"
        className="flex max-h-full w-full flex-col overflow-y-auto bg-white sm:max-w-[720px] sm:rounded-[20px] sm:border sm:border-[#E3E8E5] sm:shadow-[0_18px_50px_rgba(15,20,18,0.18)]"
      >
        {/* En el celular: «Cancelar · Ajustar logo · Listo» arriba. */}
        <div className="flex items-center justify-between bg-[#0F1412] px-4 py-3.5 text-[14px] font-bold text-white sm:hidden">
          <button type="button" onClick={alCerrar}>
            Cancelar
          </button>
          <span>Ajustar logo</span>
          <button
            type="button"
            disabled={guardando}
            onClick={() => alGuardar(ajuste)}
            className="text-[#22D37A] disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Listo'}
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:p-[22px]">
          <div className="hidden items-center justify-between sm:flex">
            <b id="titulo-ajustar-logo" className="text-[19px] font-bold">
              Ajustar logo
            </b>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={alCerrar}
              className="rounded-full p-1 text-[#59645e] hover:bg-superficie"
            >
              <IconX size={20} stroke={1.8} aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-5 sm:grid-cols-[300px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <div
                ref={marco}
                role="application"
                tabIndex={0}
                aria-label="Mueve el logo con las flechas; acerca con + y aleja con −"
                className="relative aspect-square w-full max-w-[300px] cursor-grab touch-none select-none overflow-hidden rounded-[14px] bg-[#0F1412] outline-none focus-visible:ring-2 focus-visible:ring-pase active:cursor-grabbing max-sm:mx-auto"
                onPointerDown={(evento) => {
                  evento.currentTarget.setPointerCapture(evento.pointerId);
                  dedos.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
                  distancia.current = null;
                }}
                onPointerMove={(evento) => {
                  const antes = dedos.current.get(evento.pointerId);
                  if (!antes) return;
                  dedos.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
                  if (dedos.current.size >= 2) {
                    // Dos dedos: acercar o alejar.
                    const [a, b] = [...dedos.current.values()];
                    if (!a || !b) return;
                    const ahora = Math.hypot(a.x - b.x, a.y - b.y);
                    if (distancia.current) acercar(ajuste.zoom * (ahora / distancia.current));
                    distancia.current = ahora;
                    return;
                  }
                  mover(evento.clientX - antes.x, evento.clientY - antes.y);
                }}
                onPointerUp={(evento) => {
                  dedos.current.delete(evento.pointerId);
                  distancia.current = null;
                }}
                onPointerCancel={(evento) => {
                  dedos.current.delete(evento.pointerId);
                  distancia.current = null;
                }}
                onWheel={(evento) => acercar(ajuste.zoom * Math.exp(-evento.deltaY * 0.0015))}
                onKeyDown={(evento) => {
                  const paso = evento.shiftKey ? 20 : 5;
                  const teclas: Record<string, () => void> = {
                    ArrowLeft: () => mover(paso, 0),
                    ArrowRight: () => mover(-paso, 0),
                    ArrowUp: () => mover(0, paso),
                    ArrowDown: () => mover(0, -paso),
                    '+': () => acercar(ajuste.zoom * 1.1),
                    '=': () => acercar(ajuste.zoom * 1.1),
                    '-': () => acercar(ajuste.zoom / 1.1),
                  };
                  const tecla = teclas[evento.key];
                  if (!tecla) return;
                  evento.preventDefault();
                  tecla();
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute rounded-full"
                  style={{
                    left: borde,
                    top: borde,
                    width: diametro,
                    height: diametro,
                    background: fondoDe(ajuste.fondo),
                  }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagen.src}
                  alt=""
                  draggable={false}
                  style={estiloImagen(imagen, ajuste, diametro, borde)}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_400px_rgba(15,20,18,0.62)]"
                  style={{ left: borde, top: borde, width: diametro, height: diametro }}
                />
                <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(15,20,18,0.75)] px-2.5 py-1 text-[11.5px] text-white">
                  <span className="max-sm:hidden">✥ Arrastra para mover</span>
                  <span className="sm:hidden">Mueve con un dedo · acerca o aleja con dos</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-[18px] font-bold text-[#59645e]">
                <button
                  type="button"
                  aria-label="Alejar"
                  onClick={() => acercar(ajuste.zoom - 0.25)}
                  className="px-1"
                >
                  −
                </button>
                <input
                  type="range"
                  aria-label="Zoom"
                  min={ZOOM_MINIMO}
                  max={ZOOM_MAXIMO}
                  step={0.01}
                  value={Math.max(ZOOM_MINIMO, ajuste.zoom)}
                  onChange={(evento) => acercar(Number(evento.target.value))}
                  className="h-[5px] flex-1 accent-pase"
                />
                <button
                  type="button"
                  aria-label="Acercar"
                  onClick={() => acercar(ajuste.zoom + 0.25)}
                  className="px-1"
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAjuste((actual) => ({ ...actual, x: 0.5, y: 0.5 }))}
                  className={`${botonChico} border-[#D6DDD9] bg-white`}
                >
                  ⊕ Centrar
                </button>
                <button
                  type="button"
                  onClick={girar}
                  className={`${botonChico} border-[#D6DDD9] bg-white`}
                >
                  ↺ Girar
                </button>
                <button
                  type="button"
                  aria-pressed={entero}
                  onClick={() =>
                    setAjuste((actual) => ({
                      ...actual,
                      x: 0.5,
                      y: 0.5,
                      zoom: zoomEntero(imagen, actual.rotacion),
                    }))
                  }
                  className={`${botonChico} ${
                    entero
                      ? 'border-pase bg-[#E9F7EF] font-extrabold text-[#006B47]'
                      : 'border-[#D6DDD9] bg-white'
                  }`}
                >
                  {entero ? '✓ ' : ''}Que entre entero
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 text-[13.5px]">
              <b className="font-bold">Color de fondo</b>
              <div
                role="radiogroup"
                aria-label="Color de fondo"
                className="flex flex-wrap items-center gap-2.5"
              >
                {colores.map(([color, texto]) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={ajuste.fondo === color}
                    aria-label={texto}
                    title={texto}
                    onClick={() => setAjuste((actual) => ({ ...actual, fondo: color }))}
                    className={`h-[30px] w-[30px] rounded-full border-[1.5px] border-[#D6DDD9] ${
                      ajuste.fondo === color
                        ? 'outline outline-[2.5px] outline-offset-2 outline-tinta'
                        : ''
                    }`}
                    style={{ background: fondoDe(color) }}
                  />
                ))}
                {delBorde && delBorde !== BLANCO && delBorde !== NEGRO && (
                  <span className="text-[12.5px] text-[#59645e]">
                    Toma el color del borde de tu imagen
                  </span>
                )}
              </div>
              <b className="mt-1 font-bold">Así se va a ver</b>
              {vistas}
              {avisos.length > 0 && (
                <div className="flex flex-col gap-1 rounded-[10px] bg-[#FFF4E5] px-2.5 py-2 text-[12.5px] leading-[1.45] text-[#8A4B00]">
                  {avisos.map((aviso) => (
                    <span key={aviso}>{aviso}</span>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="m-0 text-[12.5px] text-error">
                  {error}
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2.5 pt-2.5">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => alGuardar(ajuste)}
                  className="rounded-full bg-pase px-5 py-2.5 font-bold text-white disabled:opacity-60"
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={alElegirOtra}
                  className="rounded-full border-[1.5px] border-[#D6DDD9] px-[18px] py-2.5 font-bold"
                >
                  Elegir otra imagen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
