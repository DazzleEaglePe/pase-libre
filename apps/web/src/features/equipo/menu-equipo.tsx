'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { iniciales } from '@/shared/iniciales';

/**
 * Tu nombre en la barra del panel (doc 19, punto 7): un botón con tus iniciales y «▾» que abre
 * Mi cuenta · Versiones · Cerrar sesión. El menú sigue el modo claro u oscuro del panel.
 */
export function MenuEquipo({
  nombre,
  usuario,
  oscuro,
}: {
  nombre: string;
  usuario: string;
  oscuro: boolean;
}) {
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

  const forma = `flex min-h-10 w-full items-center rounded-lg px-2.5 text-left text-apoyo no-underline ${
    oscuro ? 'hover:bg-[#163a2b]' : 'hover:bg-pase-suave'
  }`;
  const opcion = `${forma} ${oscuro ? 'text-[#f1f4f2]' : 'text-tinta'}`;

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto(!abierto)}
        className={`flex h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-apoyo font-semibold text-white ${
          abierto ? 'bg-white/20' : 'bg-white/10 hover:bg-white/20'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-nota font-extrabold text-white"
        >
          {iniciales(nombre)}
        </span>
        {/* Solo el nombre de pila: la barra tiene que entrar entera a 1440 px. */}
        <span className="max-w-[120px] truncate">{nombre.trim().split(/\s+/)[0]}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
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
          aria-label="Tu cuenta del Equipo"
          className={`absolute right-0 top-12 z-40 w-[250px] max-w-[calc(100vw-32px)] rounded-[14px] border p-2 shadow-[0_12px_30px_rgba(0,0,0,0.3)] ${
            oscuro
              ? 'border-[#3a4540] bg-[#222b27] text-[#f1f4f2]'
              : 'border-linea bg-white text-tinta'
          }`}
        >
          <div
            className={`mb-1 flex flex-col border-b px-2.5 pb-2 pt-1.5 ${
              oscuro ? 'border-[#3a4540]' : 'border-linea'
            }`}
          >
            <b className="truncate text-apoyo font-bold">{nombre}</b>
            <span className={`text-nota ${oscuro ? 'text-[#b5c0ba]' : 'text-detalle'}`}>
              Administrador · usuario {usuario}
            </span>
          </div>
          <Link
            href="/equipo/mi-cuenta"
            role="menuitem"
            onClick={() => setAbierto(false)}
            className={opcion}
          >
            Mi cuenta
          </Link>
          <Link
            href="/equipo/versiones"
            role="menuitem"
            onClick={() => setAbierto(false)}
            className={opcion}
          >
            Versiones
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={saliendo}
            onClick={() => void salir()}
            className={`${forma} ${oscuro ? 'text-[#f4b066]' : 'text-aviso'}`}
          >
            {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
