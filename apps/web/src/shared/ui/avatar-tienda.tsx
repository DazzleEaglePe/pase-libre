import { urlFoto } from '@paselibre/contracts';

import { iniciales } from '@/shared/iniciales';

/** Fondos oscuros del lienzo (N13) para las iniciales, siempre el mismo para cada nombre. */
const FONDOS = ['bg-tinta', 'bg-[#0E5A8A]', 'bg-secundario', 'bg-marca', 'bg-[#5B21B6]'];

function fondoDe(nombre: string): string {
  let suma = 0;
  for (const letra of nombre) suma += letra.charCodeAt(0);
  return FONDOS[suma % FONDOS.length] ?? 'bg-tinta';
}

/**
 * El círculo de una tienda (N13): su logo o sus iniciales, y el puntito verde si alguien de la
 * tienda tiene PaseLibre abierto ahora.
 */
export function AvatarTienda({
  nombre,
  logo,
  enLinea = false,
  grande = false,
}: {
  nombre: string;
  logo: string | null;
  enLinea?: boolean;
  /** 48 px (directorio) en vez de 40 (buscador). */
  grande?: boolean;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${
        grande ? 'h-12 w-12 text-[17px]' : 'h-10 w-10 text-apoyo'
      } ${logo ? 'bg-superficie' : fondoDe(nombre)}`}
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
        <span aria-hidden="true">{iniciales(nombre)}</span>
      )}
      {enLinea && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-[2.5px] border-white bg-[#22C55E] ${
            grande ? 'h-[13px] w-[13px]' : 'h-[11px] w-[11px]'
          }`}
        >
          <span className="sr-only">En línea ahora</span>
        </span>
      )}
    </span>
  );
}
