'use client';

import { urlFoto, type PerfilTienda, type PortadaTienda } from '@paselibre/contracts';
import {
  IconArrowsMove,
  IconBolt,
  IconBuildingStore,
  IconCamera,
  IconPhoto,
  IconTrash,
  type Icon,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';

/** Colores de la portada automática: fondo, acento y texto chico. Sale uno por tienda. */
const PALETAS: Array<[string, string, string]> = [
  ['#0B0B0C', '#D4A537', '#FFFFFF'],
  ['#14123A', '#8B5CF6', '#E9D5FF'],
  ['#062E22', '#22D37A', '#D5F5E3'],
  ['#0B2545', '#38BDF8', '#E0F2FE'],
  ['#3B0A0A', '#F97316', '#FFEDD5'],
  ['#1F2937', '#FACC15', '#F9FAFB'],
];

function paletaDe(nombre: string): [string, string, string] {
  let suma = 0;
  for (const letra of nombre) suma = (suma * 31 + letra.charCodeAt(0)) >>> 0;
  return PALETAS[suma % PALETAS.length] ?? PALETAS[0]!;
}

/**
 * Sin ninguna foto: la portada con el nombre y lo que más vende (COR1, «automática»). `sinTexto`
 * es para la cabecera A (N04), que ya escribe el nombre y lo que vende debajo del logo.
 */
function PortadaAutomatica({
  nombre,
  categorias,
  sinTexto = false,
}: {
  nombre: string;
  categorias: string[];
  sinTexto?: boolean;
}) {
  const [fondo, acento, chico] = paletaDe(nombre);
  const inicial = (nombre.trim()[0] ?? 'P').toUpperCase();
  return (
    <svg
      viewBox="0 0 1280 240"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    >
      <rect width="1280" height="240" fill={fondo} />
      <path d="M820 0h460v240H700z" fill={acento} opacity="0.12" />
      <path d="M980 0h300v240H880z" fill={acento} opacity="0.18" />
      <circle cx="1130" cy="120" r="70" fill="none" stroke={acento} strokeWidth="6" />
      <text
        x="1130"
        y="138"
        textAnchor="middle"
        fill={acento}
        fontFamily="Montserrat, sans-serif"
        fontSize="52"
        fontWeight="800"
      >
        {inicial}
      </text>
      {!sinTexto && (
        <text
          x="70"
          y="118"
          fill={acento}
          fontFamily="Montserrat, sans-serif"
          fontSize="58"
          fontWeight="800"
          letterSpacing="2"
        >
          {nombre.toUpperCase().slice(0, 24)}
        </text>
      )}
      {!sinTexto && categorias.length > 0 && (
        <text
          x="72"
          y="160"
          fill={chico}
          fontFamily="Inter, sans-serif"
          fontSize="22"
          fontWeight="600"
          letterSpacing="1"
        >
          {categorias.join(' · ')}
        </text>
      )}
      {!sinTexto && <rect x="72" y="182" width="120" height="5" rx="2" fill={acento} />}
    </svg>
  );
}

/** Una foto subida: a lo largo, recortada según «Acomodar»; vertical, entera con los costados difuminados. */
function PortadaFoto({ portada, posicion }: { portada: PortadaTienda; posicion: number }) {
  const src = urlFoto(portada.ruta);
  const vertical = (portada.alto ?? 0) > (portada.ancho ?? 1) * 0.9;
  if (vertical) {
    return (
      <>
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="absolute -inset-x-[10%] -inset-y-[60%] h-[220%] w-[120%] object-cover blur-[22px] brightness-[0.85]"
          />
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="absolute left-1/2 top-0 h-full w-auto -translate-x-1/2 object-cover shadow-[0_0_30px_rgba(0,0,0,0.35)]"
        />
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className="absolute inset-0 h-full w-full select-none object-cover"
      style={{ objectPosition: `center ${posicion}%` }}
    />
  );
}

function Opcion({
  icono: Icono,
  titulo,
  detalle,
  alElegir,
  peligro = false,
  deshabilitada = false,
}: {
  icono: Icon;
  titulo: string;
  detalle: string;
  alElegir: () => void;
  peligro?: boolean;
  deshabilitada?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={deshabilitada}
      onClick={alElegir}
      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-superficie disabled:opacity-55 disabled:hover:bg-transparent ${
        peligro ? 'text-error' : 'text-tinta'
      }`}
    >
      <Icono size={20} stroke={1.8} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="flex flex-col">
        <b className="text-[15px] font-bold">{titulo}</b>
        <span className="text-[12px] text-detalle">{detalle}</span>
      </span>
    </button>
  );
}

type DatosPortada = Pick<PerfilTienda, 'nombre' | 'portada' | 'categorias_principales'>;

/** Lo que se hace con la portada: guarda y vuelve a pedir la página. */
function useAccionPortada() {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hacer(accion: () => Promise<unknown>) {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      router.refresh();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar la portada.');
    } finally {
      setTrabajando(false);
    }
  }

  return { trabajando, error, hacer };
}

/**
 * «Cambiar portada» (COR1): subir una foto, acomodarla, usar la foto del stand, volver a la
 * automática o quitarla. `sobreFoto` es el botón blanco encima de la portada; si no, el botón con
 * borde de la fila de botones del perfil (N04_PerfilB_Web).
 */
export function MenuPortada({
  perfil,
  alAcomodar,
  sobreFoto = false,
  className = '',
}: {
  perfil: DatosPortada;
  alAcomodar: () => void;
  sobreFoto?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { trabajando, error, hacer } = useAccionPortada();
  const archivo = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', conEscape);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', conEscape);
    };
  }, [abierto]);

  async function subir(foto: File) {
    await hacer(async () => {
      const subida = await subirFoto(foto);
      await llamarApi('/cuenta/portada', { metodo: 'PUT', cuerpo: { ruta: subida.ruta } });
    });
  }

  const vertical = perfil.portada && (perfil.portada.alto ?? 0) > (perfil.portada.ancho ?? 1) * 0.9;

  return (
    <div ref={caja} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={sobreFoto ? 'Cambiar portada' : undefined}
        onClick={() => setAbierto(!abierto)}
        className={
          sobreFoto
            ? 'flex h-10 items-center gap-2 rounded-full bg-white px-3 text-apoyo font-bold text-tinta shadow-[0_4px_12px_rgba(0,0,0,0.2)] sm:px-4'
            : 'flex h-[46px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-borde bg-white px-3 text-[13px] font-bold text-tinta hover:border-borde-control sm:px-4 sm:text-apoyo'
        }
      >
        <IconCamera size={18} stroke={1.8} aria-hidden="true" />
        <span className={sobreFoto ? 'max-sm:hidden' : ''}>
          {trabajando ? 'Guardando…' : 'Cambiar portada'}
        </span>
      </button>
      <input
        ref={archivo}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(evento) => {
          const foto = evento.target.files?.[0];
          evento.target.value = '';
          if (foto) void subir(foto);
        }}
      />
      {abierto && (
        <div
          role="menu"
          aria-label="Portada de tu tienda"
          className={`absolute right-0 z-30 flex w-[280px] flex-col rounded-2xl border border-linea bg-white p-1.5 shadow-[0_18px_40px_rgba(20,22,26,0.18)] ${
            sobreFoto ? 'top-12' : 'top-14'
          }`}
        >
          <Opcion
            icono={IconPhoto}
            titulo="Subir una foto"
            detalle="Mejor horizontal · 1600 × 400 · JPG, PNG o iPhone"
            alElegir={() => {
              setAbierto(false);
              archivo.current?.click();
            }}
          />
          <Opcion
            icono={IconArrowsMove}
            titulo="Acomodar"
            detalle={
              perfil.portada && !vertical
                ? 'Arrastra para elegir qué parte se ve'
                : 'Con una foto horizontal subida'
            }
            deshabilitada={!perfil.portada || Boolean(vertical)}
            alElegir={() => {
              setAbierto(false);
              alAcomodar();
            }}
          />
          <Opcion
            icono={IconBuildingStore}
            titulo="Usar la foto de mi stand"
            detalle="Cuando el registro guarde la foto de tu stand"
            deshabilitada
            alElegir={() => undefined}
          />
          <Opcion
            icono={IconBolt}
            titulo="Portada automática"
            detalle="Con tu nombre y lo que más vendes"
            deshabilitada={!perfil.portada}
            alElegir={() => {
              setAbierto(false);
              void hacer(() => llamarApi('/cuenta/portada', { metodo: 'DELETE' }));
            }}
          />
          {perfil.portada && (
            <Opcion
              icono={IconTrash}
              titulo="Quitar portada"
              detalle="Queda la automática"
              peligro
              alElegir={() => {
                setAbierto(false);
                void hacer(() => llamarApi('/cuenta/portada', { metodo: 'DELETE' }));
              }}
            />
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-full z-30 m-0 mt-2 w-[260px] rounded-xl bg-error-fondo px-3 py-2 text-nota text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * La portada del perfil de una tienda (COR1 del lienzo final). Si la tienda subió una foto se
 * ve esa (a lo largo y recortada donde ella eligió, o vertical con los costados difuminados);
 * si no, la automática. `pinterest` es la cabecera A de N04_PerfilA_Web: más alta y que se
 * desvanece hacia abajo en la tarjeta blanca. En tu perfil, «Cambiar portada» (`editable` lo
 * pone encima de la foto; si no, `MenuPortada` va donde se quiera y abre «Acomodar» con
 * `acomodando`).
 */
export function Portada({
  perfil,
  editable = false,
  pinterest = false,
  acomodando: acomodandoDesdeFuera,
  alTerminarAcomodo,
  esquina,
  children,
}: {
  perfil: DatosPortada;
  /** Tu perfil: con «Cambiar portada» encima de la foto. */
  editable?: boolean;
  /** La cabecera A (N04): alta y desvanecida hacia abajo. */
  pinterest?: boolean;
  /** «Acomodar» abierto desde un `MenuPortada` de afuera. */
  acomodando?: boolean;
  alTerminarAcomodo?: () => void;
  /** Lo de abajo a la derecha. */
  esquina?: ReactNode;
  /** Lo de arriba a la izquierda: «Volver» en el celular. */
  children?: ReactNode;
}) {
  const [acomodandoAqui, setAcomodandoAqui] = useState(false);
  const acomodando = acomodandoDesdeFuera ?? acomodandoAqui;
  const [posicion, setPosicion] = useState(perfil.portada?.posicion ?? 50);
  const { trabajando, error, hacer } = useAccionPortada();
  const arrastre = useRef<{ y: number; desde: number } | null>(null);

  useEffect(() => setPosicion(perfil.portada?.posicion ?? 50), [perfil.portada?.posicion]);

  function terminar() {
    setAcomodandoAqui(false);
    alTerminarAcomodo?.();
  }

  // La cabecera A se desvanece en el blanco de la tarjeta (N04_PerfilA_Web).
  const desvanecer = pinterest
    ? {
        maskImage: 'linear-gradient(180deg, #000 35%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, #000 35%, transparent 100%)',
      }
    : undefined;

  return (
    <div className={`relative ${pinterest ? 'h-[200px] sm:h-[300px]' : 'h-[140px] sm:h-[240px]'}`}>
      <div
        className={`absolute inset-0 overflow-hidden bg-tinta ${pinterest ? 'rounded-t-[22px]' : 'sm:rounded-[22px]'} ${
          acomodando ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        style={desvanecer}
        onPointerDown={(evento) => {
          if (!acomodando) return;
          arrastre.current = { y: evento.clientY, desde: posicion };
          (evento.currentTarget as HTMLElement).setPointerCapture(evento.pointerId);
        }}
        onPointerMove={(evento) => {
          if (!acomodando || !arrastre.current) return;
          const alto = (evento.currentTarget as HTMLElement).clientHeight || 1;
          const delta = ((evento.clientY - arrastre.current.y) / alto) * 100;
          setPosicion(Math.min(100, Math.max(0, Math.round(arrastre.current.desde - delta))));
        }}
        onPointerUp={() => {
          arrastre.current = null;
        }}
      >
        {perfil.portada ? (
          <PortadaFoto portada={perfil.portada} posicion={posicion} />
        ) : (
          <PortadaAutomatica
            nombre={perfil.nombre}
            categorias={perfil.categorias_principales}
            sinTexto={pinterest}
          />
        )}
      </div>
      {children}
      {acomodando && (
        <div
          className={`absolute inset-x-0 z-20 flex flex-wrap items-center justify-between gap-2 bg-tinta/70 px-4 py-2.5 text-white ${
            pinterest ? 'top-0' : 'bottom-0'
          }`}
        >
          <span className="flex items-center gap-2 text-apoyo">
            <IconArrowsMove size={18} stroke={1.8} aria-hidden="true" />
            Arrastra arriba o abajo para elegir qué parte se ve
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPosicion(perfil.portada?.posicion ?? 50);
                terminar();
              }}
              className="h-9 rounded-full border border-white/60 px-4 text-apoyo font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={trabajando}
              onClick={() =>
                void hacer(() =>
                  llamarApi('/cuenta/portada', { metodo: 'PUT', cuerpo: { posicion } }),
                ).then(terminar)
              }
              className="h-9 rounded-full bg-white px-4 text-apoyo font-bold text-tinta"
            >
              {trabajando ? 'Guardando…' : 'Guardar'}
            </button>
          </span>
        </div>
      )}
      {editable && !acomodando && (
        <MenuPortada
          perfil={perfil}
          sobreFoto
          alAcomodar={() => setAcomodandoAqui(true)}
          className="absolute right-3 top-3 sm:right-5 sm:top-4"
        />
      )}
      {!acomodando && esquina && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-5">{esquina}</div>
      )}
      {error && (
        <p
          role="alert"
          className="absolute left-3 top-3 m-0 max-w-[70%] rounded-xl bg-error-fondo px-3 py-2 text-nota text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}
