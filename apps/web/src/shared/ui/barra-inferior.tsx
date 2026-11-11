'use client';

import {
  IconBolt,
  IconHome,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconUser,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useContadores } from './campanita';
import { useReservarAbajo } from './reservar-abajo';

/** Alto de la barra sin el borde de abajo del iPhone. */
const ALTO = 64;

/**
 * Solo en las secciones principales. Donde ya hay algo fijo abajo (la ficha con sus botones,
 * el chat con la caja de escribir, el formulario de publicar) o se entra para algo puntual
 * (ingresar, el panel del equipo), no va.
 */
export function enSeccionPrincipal(ruta: string): boolean {
  return (
    ruta === '/' ||
    ruta === '/buscar' ||
    ruta === '/pedidos-en-vivo' ||
    ruta === '/mensajes' ||
    ruta === '/mis-publicaciones' ||
    ruta.startsWith('/cuenta')
  );
}

function ContadorMensajes() {
  const { mensajes } = useContadores();
  if (mensajes <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-contador px-1 text-center text-[10px] font-semibold leading-[17px] text-tinta">
      {mensajes > 9 ? '9+' : mensajes}
      <span className="sr-only"> sin leer</span>
    </span>
  );
}

/**
 * La barra inferior del celular (RNF-55, M_Portada): Inicio, Buscar, Publicar, Mensajes y
 * Cuenta con sesión; sin sesión, Pedidos en vivo e Ingresar en lugar de lo que pide cuenta.
 */
export function BarraInferior({ conTienda }: { conTienda: boolean }) {
  const ruta = usePathname();
  const visible = enSeccionPrincipal(ruta);
  useReservarAbajo(ALTO, visible);
  if (!visible) return null;

  const items: Array<{ href: string; texto: string; icono: Icon; contador?: boolean }> = conTienda
    ? [
        { href: '/', texto: 'Inicio', icono: IconHome },
        { href: '/buscar', texto: 'Buscar', icono: IconSearch },
        { href: '/publicar', texto: 'Publicar', icono: IconPlus },
        { href: '/mensajes', texto: 'Mensajes', icono: IconMessageCircle, contador: true },
        { href: '/cuenta/menu', texto: 'Cuenta', icono: IconUser },
      ]
    : [
        { href: '/', texto: 'Inicio', icono: IconHome },
        { href: '/buscar', texto: 'Buscar', icono: IconSearch },
        { href: '/pedidos-en-vivo', texto: 'Pedidos en vivo', icono: IconBolt },
        { href: '/ingresar', texto: 'Ingresar', icono: IconUser },
      ];

  return (
    <>
      {/* Lo que la barra tapa al final de la página. */}
      <div aria-hidden="true" className="h-16 md:hidden" />
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-linea bg-white px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 md:hidden"
      >
        {items.map(({ href, texto, icono: Icono, contador }) => {
          const activo = href === '/' ? ruta === '/' : ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? 'page' : undefined}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 text-[12px] leading-4 no-underline ${
                activo ? 'font-semibold text-tinta' : 'font-medium text-secundario'
              }`}
            >
              <span
                className={`relative flex rounded-full px-3.5 py-[3px] ${activo ? 'bg-pase-suave text-pase' : ''}`}
              >
                <Icono size={22} stroke={1.8} aria-hidden="true" />
                {contador && conTienda && <ContadorMensajes />}
              </span>
              {texto}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
