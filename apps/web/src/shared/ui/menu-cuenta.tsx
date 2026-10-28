'use client';

import type { TiendaDeSesion } from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

const ENLACES = [
  { href: '/cuenta/configuracion', texto: 'Configuración' },
  { href: '/mis-publicaciones', texto: 'Mis publicaciones' },
  { href: '/mensajes', texto: 'Mensajes' },
] as const;

/**
 * «Mi cuenta» (C_Header): el saludo con la tienda abre el menú con Configuración y
 * «Cerrar sesión» (RF-60: al cambio de contraseña se llega desde aquí).
 */
export function MenuCuenta({ tienda, lugar }: { tienda: TiendaDeSesion; lugar: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
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

  async function salir() {
    setSaliendo(true);
    try {
      await llamarApi('/sesion', { metodo: 'DELETE' });
    } finally {
      router.refresh();
      setSaliendo(false);
    }
  }

  const inicial = (tienda.nombre.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase();

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto(!abierto)}
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left text-apoyo ${
          abierto ? 'bg-superficie' : 'hover:bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white"
        >
          {inicial}
        </span>
        <span className="flex flex-col leading-tight">
          <span>
            ¡Hola, <b className="font-semibold">{tienda.nombre}</b>!
          </span>
          {lugar && <span className="text-nota text-detalle">{lugar}</span>}
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
          className="absolute right-0 top-12 z-40 flex w-[260px] max-w-[calc(100vw-32px)] flex-col rounded-[20px] border border-linea bg-white p-2 text-apoyo shadow-[0_18px_40px_rgba(20,22,26,0.18)]"
        >
          {ENLACES.map(({ href, texto }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="flex min-h-[42px] items-center rounded-xl px-2.5 no-underline hover:bg-superficie"
            >
              {texto}
            </Link>
          ))}
          <span className="mx-2 my-1 h-px bg-linea" />
          <button
            type="button"
            role="menuitem"
            disabled={saliendo}
            onClick={() => void salir()}
            className="flex min-h-[42px] items-center rounded-xl px-2.5 text-left font-semibold hover:bg-superficie"
          >
            {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
