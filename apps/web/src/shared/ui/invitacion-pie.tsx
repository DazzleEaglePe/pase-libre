'use client';

import { IconBrandWhatsapp, IconCheck, IconCopy } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

const boton =
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-cuerpo font-semibold no-underline';
const principal = `${boton} bg-white text-marca hover:bg-pase-suave`;
const secundario = `${boton} border border-pase-medio text-white hover:bg-white/10`;

/**
 * La banda verde del pie (D_Pie): quien no tiene cuenta la pide; quien la tiene invita a una
 * tienda vecina con el enlace del sitio.
 */
export function InvitacionPie({ conSesion }: { conSesion: boolean }) {
  const [copiado, setCopiado] = useState(false);

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
    <section className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-3xl bg-marca px-6 py-6 sm:px-8 sm:py-7">
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
            <button type="button" onClick={compartir} className={principal}>
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
