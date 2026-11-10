'use client';

import { IconBan, IconDots, IconFlag, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

import { VentanaBloquear, VentanaReporte } from './ventanas';

/**
 * «Más opciones» (REP_Web): ver el perfil de la tienda, reportar y bloquear. Con la tienda
 * reservada (`tienda` nulo) solo se puede reportar: no se sabe de quién es.
 */
export function MenuOpciones({
  tienda,
  objeto,
  objetoId,
  sobre,
  sobreMarca = false,
}: {
  tienda: { id: string; nombre: string } | null;
  objeto: 'OFERTA' | 'TIENDA';
  objetoId: string;
  /** «Publicación · RTX 3070 Ventus 3X». */
  sobre: string;
  /** En la cabecera verde del celular: el botón en blanco. */
  sobreMarca?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ventana, setVentana] = useState<'reportar' | 'bloquear' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const afuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const opcion =
    'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-apoyo text-tinta no-underline hover:bg-superficie';
  const icono = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full';

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className={`flex h-11 w-11 items-center justify-center rounded-full ${
          sobreMarca ? 'text-white hover:bg-white/15' : 'border border-borde bg-white text-tinta'
        }`}
      >
        <IconDots size={22} stroke={2} aria-hidden="true" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-40 flex w-[300px] flex-col rounded-2xl border border-linea bg-white p-1.5 shadow-[0_18px_40px_rgba(20,22,26,0.18)]"
        >
          {tienda && objeto === 'OFERTA' && (
            <Link role="menuitem" href={`/tiendas/${tienda.id}`} className={opcion}>
              <span className={`${icono} bg-superficie text-secundario`}>
                <IconUser size={18} stroke={1.8} aria-hidden="true" />
              </span>
              Ver perfil de {tienda.nombre}
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAbierto(false);
              setVentana('reportar');
            }}
            className={opcion}
          >
            <span className={`${icono} bg-superficie text-secundario`}>
              <IconFlag size={18} stroke={1.8} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              {tienda && objeto === 'TIENDA' ? `Reportar a ${tienda.nombre}` : 'Reportar'}
              <span className="text-nota text-secundario">
                Estafa, no cumplió con lo descrito o mal trato
              </span>
            </span>
          </button>
          {tienda && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                setVentana('bloquear');
              }}
              className={`${opcion} font-semibold !text-error`}
            >
              <span className={`${icono} bg-error-fondo text-error`}>
                <IconBan size={18} stroke={1.8} aria-hidden="true" />
              </span>
              Bloquear a {tienda.nombre}
            </button>
          )}
        </div>
      )}

      {ventana === 'reportar' && (
        <VentanaReporte
          objeto={objeto}
          objetoId={objetoId}
          tienda={tienda?.nombre ?? null}
          sobre={sobre}
          alCerrar={() => setVentana(null)}
          alBloquear={() => router.refresh()}
        />
      )}
      {ventana === 'bloquear' && tienda && (
        <VentanaBloquear
          tienda={tienda.nombre}
          alCerrar={() => setVentana(null)}
          alBloquear={async () => {
            await llamarApi(`/tiendas/${tienda.id}/bloqueo`, { metodo: 'POST' });
            setAviso(`Bloqueaste a ${tienda.nombre}. Ya no verás sus publicaciones.`);
            router.refresh();
          }}
          alReportar={() => setVentana('reportar')}
        />
      )}
      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white shadow-lg md:bottom-8"
        >
          {aviso}
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="h-9 rounded-full px-3 font-bold text-acento"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
