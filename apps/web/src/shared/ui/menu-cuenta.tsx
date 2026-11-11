'use client';

import type { TiendaDeSesion } from '@paselibre/contracts';
import {
  IconBell,
  IconBolt,
  IconClock,
  IconListDetails,
  IconLogout,
  IconSettings,
  IconUser,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useEnVivoCompartido } from '@/features/en-vivo/contexto';
import { llamarApi } from '@/shared/api/cliente';
import { iniciales } from '@/shared/iniciales';

import { useContadores } from './campanita';

interface Opcion {
  href: string;
  texto: string;
  detalle?: string;
  icono: Icon;
  contador?: number;
}

/** «1 activo · termina en 12 min»: lo que la tienda tiene en vivo ahora. */
function useDetalleEnVivo(): string {
  const compartido = useEnVivoCompartido();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(reloj);
  }, []);
  const datos = compartido?.datos;
  const mios =
    datos && datos.audiencia !== 'visitante' ? datos.en_vivo.filter((p) => p.propio) : [];
  if (mios.length === 0) return 'Pide algo o remata: les llega al toque';
  const primero = Math.min(...mios.map((pedido) => new Date(pedido.vence_en).getTime()));
  const minutos = Math.max(1, Math.round((primero - ahora) / 60_000));
  const termina =
    minutos >= 60 ? `termina en ${Math.round(minutos / 60)} h` : `termina en ${minutos} min`;
  return `${mios.length} ${mios.length === 1 ? 'activo' : 'activos'} · ${termina}`;
}

function Grupo({
  titulo,
  opciones,
  alElegir,
}: {
  titulo: string;
  opciones: Opcion[];
  alElegir?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-detalle">
        {titulo}
      </span>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-linea bg-white p-0">
        {opciones.map(({ href, texto, detalle, icono: Icono, contador }) => (
          <li key={href} className="border-t border-linea first:border-t-0">
            <Link
              href={href}
              role="menuitem"
              onClick={alElegir}
              className="flex min-h-[46px] items-center gap-3 px-3.5 py-2 text-tinta no-underline hover:bg-superficie"
            >
              <Icono size={19} stroke={1.7} aria-hidden="true" className="shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px]">{texto}</span>
                {detalle && <span className="text-[12px] text-detalle">{detalle}</span>}
              </span>
              {contador ? (
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-contador px-1.5 text-[12px] font-bold text-tinta">
                  {contador > 9 ? '9+' : contador}
                  <span className="sr-only"> sin leer</span>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El menú de la cuenta (COR2 y COR22 del lienzo final): arriba tu tarjeta con «Ver mi perfil»,
 * las opciones en tres cajitas («Mi tienda», «Actividad» y «Mi cuenta») y «Cerrar sesión» en
 * gris. «Mensajes» no va: ya está en el globito de arriba. Es el mismo en la computadora (el
 * menú que se abre) y en el celular (la página `/cuenta/menu`).
 */
export function ContenidoMenuCuenta({
  tienda,
  lugar,
  alElegir,
}: {
  tienda: TiendaDeSesion;
  lugar: string;
  alElegir?: () => void;
}) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const { avisos } = useContadores();
  const enVivo = useDetalleEnVivo();

  async function salir() {
    setSaliendo(true);
    try {
      await llamarApi('/sesion', { metodo: 'DELETE' });
    } finally {
      router.refresh();
      setSaliendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={`/tiendas/${tienda.id}`}
        onClick={alElegir}
        className="flex items-center gap-3 rounded-2xl border border-[#A7E3C3] bg-white p-3.5 text-tinta no-underline hover:bg-pase-suave"
      >
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-marca text-[16px] font-extrabold text-white"
        >
          {iniciales(tienda.nombre)}
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[16px] font-bold">{tienda.nombre}</b>
          {lugar && <span className="text-nota text-secundario">{lugar}</span>}
          <span className="text-apoyo font-bold text-pase-texto">Ver mi perfil ›</span>
        </span>
      </Link>
      <Grupo
        titulo="Mi tienda"
        alElegir={alElegir}
        opciones={[
          { href: '/mis-publicaciones', texto: 'Mis publicaciones', icono: IconListDetails },
          { href: '/historial', texto: 'Historial', icono: IconClock },
          { href: '/cuenta/socios', texto: 'Tus socios', icono: IconUsers },
        ]}
      />
      <Grupo
        titulo="Actividad"
        alElegir={alElegir}
        opciones={[
          {
            href: '/avisos',
            texto: 'Avisos',
            detalle: 'Todos tus avisos y cuáles te llegan',
            icono: IconBell,
            contador: avisos,
          },
          {
            href: '/pedidos-en-vivo#lo-tuyo',
            texto: 'Mis pedidos en vivo',
            detalle: enVivo,
            icono: IconBolt,
          },
        ]}
      />
      <Grupo
        titulo="Mi cuenta"
        alElegir={alElegir}
        opciones={[
          { href: '/cuenta', texto: 'Tu cuenta', icono: IconUser },
          {
            href: '/cuenta/configuracion',
            texto: 'Configuración',
            detalle: 'Datos de la tienda, privacidad y contraseña',
            icono: IconSettings,
          },
        ]}
      />
      <button
        type="button"
        role="menuitem"
        disabled={saliendo}
        onClick={() => void salir()}
        className="flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-linea bg-white text-[15px] font-semibold text-secundario hover:bg-superficie"
      >
        <IconLogout size={18} stroke={1.7} aria-hidden="true" />
        {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
      </button>
    </div>
  );
}

/** El botón de la cuenta en la barra: abre el menú (COR2). */
export function MenuCuenta({
  tienda,
  lugar,
  sobreMarca = false,
}: {
  tienda: TiendaDeSesion;
  lugar: string;
  /** En la fila verde de la barra: el nombre de la tienda en blanco (D_Barra). */
  sobreMarca?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarAfuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', cerrarAfuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarAfuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierto]);

  const inicial = (tienda.nombre.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase();

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto(!abierto)}
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left text-apoyo ${
          sobreMarca
            ? `text-white ${abierto ? 'bg-white/15' : 'hover:bg-white/15'}`
            : abierto
              ? 'bg-superficie'
              : 'hover:bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white"
        >
          {inicial}
        </span>
        <span className="max-w-[160px] truncate font-semibold max-sm:sr-only">
          {sobreMarca ? tienda.nombre : 'Mi cuenta'}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <div
          role="menu"
          aria-label="Mi cuenta"
          className="absolute right-0 top-12 z-40 w-[340px] max-w-[calc(100vw-32px)] rounded-[22px] border border-linea bg-superficie p-2.5 text-tinta shadow-[0_18px_40px_rgba(20,22,26,0.18)]"
        >
          <ContenidoMenuCuenta tienda={tienda} lugar={lugar} alElegir={() => setAbierto(false)} />
        </div>
      )}
    </div>
  );
}
