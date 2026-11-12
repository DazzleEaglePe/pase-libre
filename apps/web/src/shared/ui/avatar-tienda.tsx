import { urlFoto } from '@paselibre/contracts';
import type { CSSProperties } from 'react';

import { iniciales } from '@/shared/iniciales';

/** Fondos oscuros del lienzo (N13) para las iniciales, siempre el mismo para cada nombre. */
const FONDOS = ['bg-tinta', 'bg-[#0E5A8A]', 'bg-secundario', 'bg-marca', 'bg-[#5B21B6]'];

function fondoDe(nombre: string): string {
  let suma = 0;
  for (const letra of nombre) suma += letra.charCodeAt(0);
  return FONDOS[suma % FONDOS.length] ?? 'bg-tinta';
}

/** El tamaño de las iniciales: un tercio del círculo, nunca menos de 10 px. */
const letraPara = (tamano: number): number => Math.max(10, Math.round(tamano * 0.33));

/**
 * El círculo de una tienda (N13, punto 6 de la 1.9.0): su logo recortado en círculo, o sus
 * iniciales si no lo subió, y el puntito verde si alguien de la tienda tiene PaseLibre abierto
 * ahora. Es el único círculo de tienda del sitio: donde salga una tienda, va este.
 */
export function AvatarTienda({
  nombre,
  logo,
  tamano = 40,
  tamanoCelular,
  letra,
  letras,
  fondo,
  enLinea = false,
  oculto = false,
  className = '',
}: {
  nombre: string;
  /** La ruta del logo (`urlFoto`); nula o vacía: las iniciales. */
  logo: string | null | undefined;
  /** En px: 28, 32, 40, 44, 52… (40 por defecto). */
  tamano?: number;
  /** En px, para el celular (menos de 640 px de ancho), si cambia. */
  tamanoCelular?: number;
  /** Las iniciales, en px, si no van al tercio del círculo. */
  letra?: number;
  /** Otras letras en vez de las iniciales («D» en la cabecera, «·» en la reservada). */
  letras?: string;
  /** Fondo, color y grosor de las iniciales, como estaban en cada lugar. */
  fondo?: string;
  enLinea?: boolean;
  /** Solo de adorno: el nombre ya se lee al lado (lo saltan los lectores de pantalla). */
  oculto?: boolean;
  /** Clases de más: un borde, un margen. */
  className?: string;
}) {
  const celular = tamanoCelular ?? tamano;
  const estilo = {
    '--avatar': `${tamano}px`,
    '--avatar-cel': `${celular}px`,
    '--avatar-letra': `${letra ?? letraPara(tamano)}px`,
    '--avatar-letra-cel': `${letra ? Math.round((letra * celular) / tamano) : letraPara(celular)}px`,
  } as CSSProperties;
  const punto = tamano >= 48 ? 'h-[13px] w-[13px]' : 'h-[11px] w-[11px]';

  return (
    <span
      aria-hidden={oculto ? 'true' : undefined}
      data-logo={logo ? 'si' : 'no'}
      style={estilo}
      className={`relative flex h-[var(--avatar)] w-[var(--avatar)] shrink-0 items-center justify-center rounded-full text-[length:var(--avatar-letra)] max-sm:h-[var(--avatar-cel)] max-sm:w-[var(--avatar-cel)] max-sm:text-[length:var(--avatar-letra-cel)] ${
        logo ? 'bg-superficie' : (fondo ?? `${fondoDe(nombre)} font-extrabold text-white`)
      } ${className}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFoto(logo)}
          alt=""
          loading="lazy"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{letras ?? iniciales(nombre)}</span>
      )}
      {enLinea && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-[2.5px] border-white bg-[#22C55E] ${punto}`}
        >
          {!oculto && <span className="sr-only">En línea ahora</span>}
        </span>
      )}
    </span>
  );
}
