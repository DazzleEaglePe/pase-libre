'use client';

import { IconBrandWhatsapp, IconBuildingStore, IconCheck, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { CONTACTO } from '@/shared/contacto';

const boton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-cuerpo font-semibold no-underline';
const principal = `${boton} bg-pase text-white`;
const secundario = `${boton} border border-borde bg-white text-tinta hover:border-borde-control`;

/**
 * La invitación del pie (D): donde la referencia ponía «suscríbete a ofertas», aquí se pide
 * la cuenta; con sesión, se invita a una tienda vecina con el enlace del sitio.
 */
export function InvitacionPie({ conSesion }: { conSesion: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const whatsapp = CONTACTO.whatsapp?.href ?? null;

  function enlace(): string {
    return window.location.origin;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso para el portapapeles no hay nada que hacer: el botón queda como estaba.
    }
  }

  function compartir() {
    const texto = `Te invito a PaseLibre, el catálogo para pasarse productos entre tiendas de Wilson: ${enlace()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-3xl bg-white p-6 text-tinta sm:px-7">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
        <IconBuildingStore size={28} stroke={1.5} aria-hidden="true" />
        <b className="text-seccion">
          {conSesion ? 'Invita a una tienda vecina' : '¿Tienes tienda en Galería Wilson?'}
        </b>
        <span className="text-cuerpo text-secundario">
          {conSesion
            ? 'Mientras más tiendas haya en PaseLibre, más fácil consigues lo que te falta.'
            : 'Pide tu cuenta gratis: publicas en un minuto y ves los precios de las demás tiendas.'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {conSesion ? (
          <>
            <button type="button" onClick={compartir} className={principal}>
              <IconBrandWhatsapp size={18} stroke={1.5} aria-hidden="true" />
              Compartir por WhatsApp
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
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={secundario}>
                <IconBrandWhatsapp size={18} stroke={1.5} aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
