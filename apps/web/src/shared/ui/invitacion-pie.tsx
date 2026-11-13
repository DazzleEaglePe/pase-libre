'use client';

import { IconBrandWhatsapp, IconCheck, IconCopy, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

const boton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-cuerpo font-semibold no-underline';
const principal = `${boton} bg-white text-marca hover:bg-pase-suave`;
const secundario = `${boton} border border-pase-medio text-white hover:bg-white/10`;

/** «Invita a una tienda vecina» de «Primeros pasos» queda hecho en este navegador. */
export const CLAVE_INVITO = 'paselibre:invito-tienda';

export function marcarInvito() {
  try {
    window.localStorage.setItem(CLAVE_INVITO, '1');
  } catch {
    // Sin almacenamiento, el paso se tacha solo mientras dure la página.
  }
  window.dispatchEvent(new Event('paselibre:invito'));
}

/** El mensaje de WhatsApp con el enlace del sitio, para invitar a una tienda vecina. */
export function invitarPorWhatsApp() {
  const texto = `Te invito a PaseLibre, el catálogo para pasarse productos entre tiendas de Wilson: ${window.location.origin}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  marcarInvito();
}

/**
 * La banda verde (D_Pie, N07): quien no tiene cuenta la pide; quien la tiene invita a una
 * tienda vecina con el enlace del sitio. Con `alCerrar` lleva la X: en el inicio
 * (`BannerInvitar`) y al final de las secciones de la barra negra (`InvitacionSecciones`).
 */
export function InvitacionPie({
  conSesion,
  alCerrar,
  etiquetaCerrar = 'Cerrar: no volver a mostrar',
}: {
  conSesion: boolean;
  alCerrar?: () => void;
  /** Lo que lee el lector de pantalla en la X. */
  etiquetaCerrar?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiado(true);
      marcarInvito();
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso para el portapapeles no hay nada que hacer: el botón queda como estaba.
    }
  }

  return (
    <section
      className={`relative flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-3xl bg-marca px-6 py-6 sm:px-8 sm:py-7 ${
        alCerrar ? 'pr-14 sm:pr-16' : ''
      }`}
    >
      {alCerrar && (
        <button
          type="button"
          onClick={alCerrar}
          aria-label={etiquetaCerrar}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-4 sm:top-1/2 sm:-translate-y-1/2"
        >
          <IconX size={16} stroke={2.2} aria-hidden="true" />
        </button>
      )}
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5">
        <h2 className="text-seccion">
          {conSesion
            ? '¿Conoces una tienda que debería estar aquí?'
            : '¿Tienes tienda en Galería Wilson?'}
        </h2>
        <p className="text-cuerpo text-pase-medio">
          {conSesion
            ? 'Invítala: entre más tiendas, más encuentras sin salir del stand.'
            : 'Pide tu cuenta gratis: publicas en un minuto y ves los precios de las demás tiendas. Solo para tiendas de las galerías de Wilson.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {conSesion ? (
          <>
            <button type="button" onClick={invitarPorWhatsApp} className={principal}>
              <IconBrandWhatsapp size={18} stroke={1.5} aria-hidden="true" />
              Invitar por WhatsApp
            </button>
            <button type="button" onClick={() => void copiar()} className={secundario}>
              {copiado ? (
                <IconCheck size={18} stroke={1.8} aria-hidden="true" />
              ) : (
                <IconCopy size={18} stroke={1.5} aria-hidden="true" />
              )}
              <span aria-live="polite">{copiado ? '¡Copiado!' : 'Copiar enlace'}</span>
            </button>
          </>
        ) : (
          <>
            <Link href="/ingresar?pestana=crear" className={principal}>
              Pedir mi cuenta
            </Link>
            <Link href="/ingresar" className={secundario}>
              Ya tengo cuenta
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
