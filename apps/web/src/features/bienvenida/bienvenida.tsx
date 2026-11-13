'use client';

import { IconCheck, IconCircleCheckFilled, IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** Las cuatro pantallas de «Conoce PaseLibre» (OB_WebB, OB_CelB…OB_CelB4): un dibujo y su frase. */
const PANTALLAS: Array<{ titulo: string; texto: string; dibujo: ReactNode }> = [
  {
    titulo: 'Todo lo que buscas, en un solo lugar',
    texto:
      'El stock de todas las tiendas de Wilson, aquí. Sin ir stand por stand ni comparar Excels.',
    dibujo: <DibujoAntesAhora />,
  },
  {
    titulo: 'Cuando la venta no espera',
    texto: 'Ves quién lo tiene, en qué estado y a cuánto. Al instante, con el stock al día.',
    dibujo: <DibujoStock />,
  },
  {
    titulo: 'Tus precios, solo entre tiendas',
    texto: 'Aquí solo entran tiendas verificadas de Wilson. Un cliente final nunca ve tus precios.',
    dibujo: <DibujoPrecios />,
  },
  {
    titulo: '¿No lo encuentras? Pídelo en vivo',
    texto: 'Publica un «Busco» y las tiendas te responden en minutos.',
    dibujo: <DibujoBusco />,
  },
];

/** Los acuerdos rápidos entre tiendas (N05). */
const ACUERDOS = [
  'Publico productos que de verdad tengo y mantengo mi stock al día.',
  'Respeto el precio y el trato que acuerdo en el chat.',
  'Trato con respeto a las demás tiendas.',
  'Mis precios de pase son solo para tiendas.',
];

/** El paso de los acuerdos, después de las cuatro pantallas. */
const PASO_ACUERDOS = PANTALLAS.length;

/** Cuánto dura el aviso verde «Tu contraseña quedó guardada». */
export const AVISO_CLAVE_MS = 3000;

/**
 * Viene de crear su contraseña (paso 1 de 3): lo guarda la pestaña para que el recorrido diga
 * «Paso 2 de 3» y muestre el aviso verde. `clave-guardada` todavía no mostró el aviso;
 * `recorrido`, ya (si recarga, no vuelve a salir).
 */
const CLAVE_PRIMER_INGRESO = 'paselibre:primer-ingreso';

/** Lo llama «Crea tu contraseña» justo antes de llevar al inicio (doc 19, punto 11). */
export function avisarClaveGuardada(): void {
  try {
    window.sessionStorage.setItem(CLAVE_PRIMER_INGRESO, 'clave-guardada');
  } catch {
    // Sin almacenamiento, el recorrido sale igual, solo que sin el aviso verde.
  }
}

function leerPrimerIngreso(): string | null {
  try {
    return window.sessionStorage.getItem(CLAVE_PRIMER_INGRESO);
  } catch {
    return null;
  }
}

function guardarPrimerIngreso(valor: string | null): void {
  try {
    if (valor) window.sessionStorage.setItem(CLAVE_PRIMER_INGRESO, valor);
    else window.sessionStorage.removeItem(CLAVE_PRIMER_INGRESO);
  } catch {
    // Nada que hacer: es solo para el texto del paso.
  }
}

const tarjeta =
  'w-full max-w-[300px] rounded-2xl bg-white text-tinta shadow-[0_8px_24px_rgba(0,0,0,0.18)]';

function DibujoAntesAhora() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-1.5 px-3.5 py-3.5`}>
        <span className="text-etiqueta uppercase text-error">Antes</span>
        {[
          'Stand por stand: «¿tienes pase?»',
          'El Excel de cada tienda',
          'Comparar precios uno a uno',
        ].map((linea) => (
          <s key={linea} className="text-apoyo text-secundario">
            {linea}
          </s>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-tinta px-3.5 py-3.5 text-white">
        <span className="text-etiqueta uppercase text-acento">Ahora</span>
        <span className="flex items-center gap-2.5 text-cuerpo font-bold">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Todas las tiendas de Wilson, en un solo lugar
        </span>
      </div>
    </div>
  );
}

function DibujoStock() {
  const filas = [
    ['CGS', 'Nuevo · 4 disponibles', 'US$ 299'],
    ['Tienda F', 'Open box · 1 disponible', 'US$ 285'],
    ['MegaPC', 'Usado · 2 disponibles', 'US$ 260'],
  ];
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-2.5">
      <div className={`${tarjeta} flex flex-col`}>
        <b className="border-b border-linea px-3.5 py-3 text-cuerpo font-bold">
          RTX 4060 8 GB · 3 tiendas
        </b>
        {filas.map(([tienda, estado, precio]) => (
          <div
            key={tienda}
            className="flex items-center justify-between gap-3 border-b border-linea px-3.5 py-2.5 last:border-b-0"
          >
            <span className="flex flex-col">
              <b className="text-apoyo font-bold">{tienda}</b>
              <span className="text-nota text-secundario">{estado}</span>
            </span>
            <span className="rounded-full bg-tinta px-2.5 py-1 text-apoyo font-bold text-white">
              {precio}
            </span>
          </div>
        ))}
      </div>
      <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-nota font-bold text-marca">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-pase" />
        Stock al día · en segundos
      </span>
    </div>
  );
}

function DibujoPrecios() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-2 px-3.5 py-3.5`}>
        <span className="text-etiqueta uppercase text-pase-texto">Lo que ve otra tienda</span>
        <b className="text-cuerpo font-bold">MSI RTX 3070 Ventus 3X</b>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-tinta px-2.5 py-1 text-cuerpo font-bold text-white">
            US$ 285
          </span>
          <span className="text-nota text-secundario">Tienda B · Stand 101</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/60 px-3.5 py-3.5 text-white">
        <span className="text-etiqueta uppercase">Lo que ve un cliente</span>
        <span className="flex items-center gap-2 text-cuerpo font-bold">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Precio con sesión
        </span>
        <span className="text-nota">Ve que hay stock, pero nunca tu precio</span>
      </div>
    </div>
  );
}

function DibujoBusco() {
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-1.5 px-3.5 py-3.5`}>
        <span className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-pase-medio px-2.5 py-1 text-nota font-bold text-marca">
            Busco
          </span>
          <span className="text-nota font-bold text-aviso">Termina en 1 h</span>
        </span>
        <b className="text-cuerpo font-bold">RTX 4060 8 GB</b>
        <span className="text-apoyo text-secundario">Pago hasta US$ 300</span>
      </div>
      <span className="flex w-full items-center gap-2.5 rounded-xl bg-contador px-3.5 py-3 text-apoyo font-bold text-tinta">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta" />3 tiendas dijeron «¡Lo
        tengo!»
      </span>
      <span className="text-nota font-bold text-white">en 6 minutos</span>
    </div>
  );
}

/**
 * La bienvenida del primer ingreso (doc 19, punto 11, Bienvenida A): después de «Crea tu
 * contraseña» (paso 1 de 3) vienen las cuatro pantallas de «Conoce PaseLibre» (paso 2), sobre
 * el verde de la marca, con «Saltar», puntos y «Atrás»/«Siguiente»; y al final los acuerdos
 * entre tiendas (paso 3), con «Atrás» y «¡Empezar!». «Saltar» lleva a los acuerdos: esos no se
 * saltan. «¡Empezar!» lo guarda en la cuenta (`POST /v1/cuenta/bienvenida`) y no vuelve a
 * salir. Si la contraseña ya era definitiva, no hubo paso 1: son 2 pasos. Al llegar de crear la
 * contraseña, un aviso verde de 3 s dice que quedó guardada. En la computadora es una ventana
 * encima del inicio; en el celular ocupa toda la pantalla.
 */
export function Bienvenida() {
  const id = useId();
  const [abierta, setAbierta] = useState(true);
  const [paso, setPaso] = useState(0);
  const [acepto, setAcepto] = useState(false);
  /** Viene de crear su contraseña: el recorrido es de 3 pasos. */
  const [conClave, setConClave] = useState(false);
  const [avisoClave, setAvisoClave] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const enAcuerdos = paso === PASO_ACUERDOS;
  const total = conClave ? 3 : 2;

  useEffect(() => {
    const primerIngreso = leerPrimerIngreso();
    if (!primerIngreso) return;
    setConClave(true);
    if (primerIngreso !== 'clave-guardada') return;
    guardarPrimerIngreso('recorrido');
    setAvisoClave(true);
    const reloj = setTimeout(() => setAvisoClave(false), AVISO_CLAVE_MS);
    return () => clearTimeout(reloj);
  }, []);

  useEffect(() => {
    const ventana = dialogo.current;
    if (abierta && ventana && !ventana.open) ventana.showModal();
  }, [abierta]);

  useEffect(() => {
    titulo.current?.focus();
  }, [paso]);

  function empezar() {
    if (!acepto) return;
    setAbierta(false);
    dialogo.current?.close();
    guardarPrimerIngreso(null);
    llamarApi('/cuenta/bienvenida', { metodo: 'POST' }).catch(() => undefined);
  }

  if (!abierta) return null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      onCancel={(evento) => {
        // Escape en «Conoce PaseLibre» es «Saltar»; los acuerdos hay que aceptarlos.
        evento.preventDefault();
        if (!enAcuerdos) setPaso(PASO_ACUERDOS);
      }}
      className={`m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent p-0 backdrop:bg-tinta/55 md:m-auto md:max-h-[calc(100dvh-48px)] ${
        enAcuerdos ? 'text-tinta md:h-fit md:w-[580px]' : 'text-white md:h-auto md:w-[560px]'
      }`}
    >
      {enAcuerdos ? (
        <Acuerdos
          id={id}
          titulo={titulo}
          etiqueta={`Paso ${total} de ${total} · Último paso`}
          acepto={acepto}
          alAceptar={setAcepto}
          alVolver={() => setPaso(PASO_ACUERDOS - 1)}
          alEmpezar={empezar}
        />
      ) : (
        <div className="flex h-full flex-col gap-5 overflow-y-auto bg-[linear-gradient(170deg,#006B47_0%,#004D33_100%)] px-6 pb-6 pt-5 md:rounded-3xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-nota font-bold text-pase-medio" aria-live="polite">
              {`PASO ${total - 1} DE ${total} · ${paso + 1} de ${PANTALLAS.length}`}
            </span>
            <button
              type="button"
              onClick={() => setPaso(PASO_ACUERDOS)}
              className="h-10 rounded-full bg-white/15 px-4 text-apoyo font-bold text-white hover:bg-white/25"
            >
              Saltar
            </button>
          </div>

          <div className="relative flex min-h-[300px] items-center justify-center rounded-3xl bg-white/10 px-5 py-10 max-md:flex-1 md:h-[450px] md:min-h-0">
            {avisoClave && paso === 0 && (
              <span
                role="status"
                className="aviso-clave-guardada absolute inset-x-3 top-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-pase-medio px-4 py-2 text-apoyo font-bold text-marca shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
              >
                <IconCircleCheckFilled size={18} aria-hidden="true" />
                Tu contraseña quedó guardada
              </span>
            )}
            {PANTALLAS[paso]!.dibujo}
          </div>

          <div className="flex flex-col gap-2">
            <h2
              ref={titulo}
              id={`${id}-titulo`}
              tabIndex={-1}
              className="text-[26px] font-bold leading-8 outline-none"
            >
              {PANTALLAS[paso]!.titulo}
            </h2>
            <p className="text-cuerpo text-white/90">{PANTALLAS[paso]!.texto}</p>
          </div>

          <div className="flex justify-center gap-1.5" role="group" aria-label="Pantallas">
            {PANTALLAS.map((otra, indice) => (
              <button
                key={otra.titulo}
                type="button"
                aria-label={`Ir a la pantalla ${indice + 1}`}
                aria-current={indice === paso ? 'step' : undefined}
                onClick={() => setPaso(indice)}
                className="flex h-6 items-center"
              >
                <span
                  className={`block h-2 rounded-full transition-[width] motion-reduce:transition-none ${
                    indice === paso ? 'w-[26px] bg-white' : 'w-2 bg-white/35'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex gap-2.5">
            {paso > 0 && (
              <button
                type="button"
                onClick={() => setPaso(paso - 1)}
                className="h-[52px] shrink-0 rounded-full border border-white/50 px-[22px] text-[16px] font-bold text-white hover:bg-white/10"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaso(paso + 1)}
              className="h-[52px] flex-1 rounded-full bg-white px-5 text-[16px] font-bold text-marca hover:bg-pase-suave"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/**
 * El último paso: los acuerdos entre tiendas (N05, mejora 44). Tono cálido: «Te protegemos de
 * estafas y malos tratos» y «todos los días» (no 24 h, para no prometer de madrugada).
 */
function Acuerdos({
  id,
  titulo,
  etiqueta,
  acepto,
  alAceptar,
  alVolver,
  alEmpezar,
}: {
  id: string;
  titulo: RefObject<HTMLHeadingElement | null>;
  etiqueta: string;
  acepto: boolean;
  alAceptar: (acepto: boolean) => void;
  alVolver: () => void;
  alEmpezar: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white md:rounded-3xl md:shadow-[0_24px_60px_rgba(15,20,18,0.25)]">
      {/* En el celular, la cabecera verde de las pantallas propias (N05_06_Celulares). */}
      <div className="flex items-center bg-marca px-5 py-3 text-white md:hidden">
        <span className="flex flex-col">
          <b className="text-[19px] font-bold leading-6">Bienvenido</b>
          <span className="text-nota text-white/85">{etiqueta}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-4 pb-6 pt-5 md:p-[30px]">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-detalle">
          {etiqueta}
        </span>
        <h2
          ref={titulo}
          id={`${id}-titulo`}
          tabIndex={-1}
          className="text-[26px] font-bold leading-8 outline-none"
        >
          ¡Qué bueno tenerte aquí! 💚
        </h2>
        <p className="m-0 text-cuerpo text-secundario">
          PaseLibre funciona porque entre tiendas nos tratamos como colegas. Antes de empezar, unos
          acuerdos rápidos:
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {ACUERDOS.map((acuerdo) => (
            <li key={acuerdo} className="flex items-start gap-2.5 text-cuerpo">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pase-suave text-pase"
              >
                <IconCheck size={14} stroke={2.4} />
              </span>
              {acuerdo}
            </li>
          ))}
        </ul>

        <div className="mt-1 flex gap-3 rounded-2xl bg-pase-suave px-4 py-3.5">
          <IconShieldCheck
            size={22}
            stroke={1.8}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-marca"
          />
          <span className="flex flex-col gap-1">
            <b className="text-cuerpo font-bold">Te protegemos de estafas y malos tratos</b>
            <span className="text-apoyo text-secundario">
              El Equipo PaseLibre está para ayudarte todos los días. Para resolver reclamos más
              rápido y cuidar a todas las tiendas, podemos revisar conversaciones y actividad en la
              plataforma, sobre todo cuando hay un reporte.
            </span>
          </span>
        </div>

        <span className="flex items-start gap-2.5 text-apoyo">
          <input
            id={`${id}-acepto`}
            type="checkbox"
            checked={acepto}
            onChange={(evento) => alAceptar(evento.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-pase"
          />
          <span>
            <label htmlFor={`${id}-acepto`}>Acepto los acuerdos y los </label>
            <Link
              href="/terminos"
              target="_blank"
              className="font-bold text-tinta underline hover:text-marca"
            >
              Términos y condiciones
            </Link>{' '}
            ·{' '}
            <Link
              href="/terminos#reglas"
              target="_blank"
              className="text-tinta underline hover:text-marca"
            >
              Ver más
            </Link>
          </span>
        </span>

        <div className="mt-1 flex gap-2.5">
          <button
            type="button"
            onClick={alVolver}
            className="h-[50px] shrink-0 rounded-full border-[1.5px] border-tinta px-[22px] text-[16px] font-bold text-tinta hover:bg-superficie"
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={alEmpezar}
            disabled={!acepto}
            className={`h-[50px] flex-1 rounded-full text-[16px] font-bold ${
              acepto ? 'bg-pase text-white hover:bg-marca' : 'bg-borde text-detalle'
            }`}
          >
            ¡Empezar!
          </button>
        </div>
      </div>
    </div>
  );
}
