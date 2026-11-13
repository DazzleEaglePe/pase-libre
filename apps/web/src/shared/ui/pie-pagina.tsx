import Link from 'next/link';
import type { ReactNode } from 'react';

import { CONTACTO, REDES, VISITANOS } from '@/shared/contacto';

import { SiHayPasesDelDia } from './beneficio-pases';
import { InvitacionPie } from './invitacion-pie';
import { InvitacionSecciones } from './invitacion-secciones';
import { VersionDelPie } from './novedades';

const ENLACES: Array<{ href: string; texto: string }> = [
  { href: '/ayuda', texto: 'Preguntas frecuentes' },
  { href: '/terminos', texto: 'Términos' },
  { href: '/terminos#reglas', texto: 'Reglas para publicar' },
  { href: '/privacidad', texto: 'Privacidad' },
];

function Ventaja({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5">
      <b className="text-cuerpo font-semibold">{titulo}</b>
      <span className="text-apoyo text-white/75">{children}</span>
    </li>
  );
}

/**
 * Pie de página (D_Pie, elegido A en N07): fondo tinta, las cuatro ventajas en texto («Tu venta
 * es tuya» cierra) y una línea con la dirección y los enlaces. Sin sesión, arriba va la banda
 * verde para pedir la cuenta. Con sesión, invitar a otra tienda sale al final del inicio
 * (`BannerInvitar`) y aquí, solo en las secciones de la barra negra y hasta que la cierren
 * (doc 19, punto 14): una sola banda por página. Lo que falta del equipo (WhatsApp, redes,
 * razón social) no sale en producción.
 */
export function PiePagina({
  conSesion = false,
  invitarCerrada = false,
}: {
  conSesion?: boolean;
  /** Cerró con la X la banda de las secciones (`invitar_secciones_cerrado`): ya no sale. */
  invitarCerrada?: boolean;
}) {
  const { whatsapp, legal } = CONTACTO;
  const redes = REDES.filter((red) => red.url);
  return (
    <footer className="bg-tinta text-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-9 px-4 pb-7 pt-10 sm:px-8 sm:pt-12">
        {conSesion ? (
          <InvitacionSecciones cerrada={invitarCerrada} />
        ) : (
          <InvitacionPie conSesion={false} />
        )}

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SiHayPasesDelDia>
            <Ventaja titulo="Pedidos en vivo">
              Publica un busco o un remate y te responden en minutos.
            </Ventaja>
          </SiHayPasesDelDia>
          <Ventaja titulo="Chat y WhatsApp">Escríbele directo a la tienda que lo tiene.</Ventaja>
          <Ventaja titulo="Precios entre tiendas">
            Tus precios solo los ven cuentas verificadas.
          </Ventaja>
          <Ventaja titulo="Tu venta es tuya">
            Tú y la otra tienda acuerdan precio y pago. PaseLibre nunca te cobrará comisión por tus
            ventas.
          </Ventaja>
        </ul>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-5 text-apoyo text-white/75 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <span>PaseLibre · {VISITANOS}</span>
          <nav aria-label="Información" className="flex flex-wrap gap-x-5 gap-y-1">
            {ENLACES.map(({ href, texto }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-11 items-center text-white no-underline hover:underline md:min-h-0"
              >
                {texto}
              </Link>
            ))}
            {whatsapp?.href && (
              <a
                href={whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center text-white no-underline hover:underline md:min-h-0"
              >
                Escríbenos por WhatsApp
              </a>
            )}
            {redes.map(({ red, nombre, url }) => (
              <a
                key={red}
                href={url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center text-white no-underline hover:underline md:min-h-0"
              >
                {nombre}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-2 text-nota text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 PaseLibre. El trato es entre vendedores: PaseLibre no interviene en las ventas.
            {legal && !legal.falta && <> · {legal.texto}</>}
          </p>
          {conSesion && <VersionDelPie oscuro />}
        </div>
      </div>
    </footer>
  );
}
