'use client';

import { IconCheck, IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** Los acuerdos rápidos entre tiendas (N05). */
const ACUERDOS = [
  'Publico productos que de verdad tengo y mantengo mi stock al día.',
  'Respeto el precio y el trato que acuerdo en el chat.',
  'Trato con respeto a las demás tiendas.',
  'Mis precios de pase son solo para tiendas.',
];

/**
 * La bienvenida del primer ingreso, paso 2 de 2 (N05, mejora 44): ya cambió su clave temporal y
 * ahora acepta los acuerdos entre tiendas. Tono cálido: «Te protegemos de estafas y malos
 * tratos» y «todos los días» (no 24 h, para no prometer de madrugada). «¡Empezar!» lo guarda en
 * la cuenta (`POST /v1/cuenta/bienvenida`) y no vuelve a salir. En la computadora es una ventana
 * encima del inicio; en el celular ocupa toda la pantalla.
 */
export function Bienvenida() {
  const id = useId();
  const [abierta, setAbierta] = useState(true);
  const [acepto, setAcepto] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ventana = dialogo.current;
    if (abierta && ventana && !ventana.open) {
      ventana.showModal();
      titulo.current?.focus();
    }
  }, [abierta]);

  function empezar() {
    if (!acepto) return;
    setAbierta(false);
    dialogo.current?.close();
    llamarApi('/cuenta/bienvenida', { metodo: 'POST' }).catch(() => undefined);
  }

  if (!abierta) return null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      // Hay que aceptar los acuerdos: Escape no la cierra.
      onCancel={(evento) => evento.preventDefault()}
      className="m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent p-0 text-tinta backdrop:bg-tinta/55 md:m-auto md:h-fit md:max-h-[calc(100dvh-48px)] md:w-[580px]"
    >
      <div className="flex h-full flex-col overflow-y-auto bg-white md:rounded-3xl md:shadow-[0_24px_60px_rgba(15,20,18,0.25)]">
        {/* En el celular, la cabecera verde de las pantallas propias (N05_06_Celulares). */}
        <div className="flex items-center bg-marca px-5 py-3 text-white md:hidden">
          <span className="flex flex-col">
            <b className="text-[19px] font-bold leading-6">Bienvenido</b>
            <span className="text-nota text-white/85">Paso 2 de 2</span>
          </span>
        </div>

        <div className="flex flex-col gap-3.5 px-4 pb-6 pt-5 md:p-[30px]">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-detalle">
            Paso 2 de 2 · Ya cambiaste tu clave temporal
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
            PaseLibre funciona porque entre tiendas nos tratamos como colegas. Antes de empezar,
            unos acuerdos rápidos:
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
                rápido y cuidar a todas las tiendas, podemos revisar conversaciones y actividad en
                la plataforma, sobre todo cuando hay un reporte.
              </span>
            </span>
          </div>

          <span className="flex items-start gap-2.5 text-apoyo">
            <input
              id={`${id}-acepto`}
              type="checkbox"
              checked={acepto}
              onChange={(evento) => setAcepto(evento.target.checked)}
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

          <button
            type="button"
            onClick={empezar}
            disabled={!acepto}
            className={`mt-1 h-[50px] w-full rounded-full text-[16px] font-bold ${
              acepto ? 'bg-pase text-white hover:bg-marca' : 'bg-borde text-detalle'
            }`}
          >
            ¡Empezar!
          </button>
        </div>
      </div>
    </dialog>
  );
}
