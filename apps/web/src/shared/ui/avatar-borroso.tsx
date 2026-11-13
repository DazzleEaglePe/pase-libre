import { iniciales } from '@/shared/iniciales';

/**
 * El logo de un perfil privado que no sigues (doc 20, punto 5): la API manda una versión chica
 * (`data:`), nunca la original, y aquí se ve borrosa. Sin logo, las iniciales borrosas.
 */
export function AvatarBorroso({
  nombre,
  logo,
  tamano = 40,
  desenfoque = 6,
  className = '',
}: {
  nombre: string;
  /** La versión chica (`data:`) que manda la API, o nula. */
  logo: string | null | undefined;
  /** En px. */
  tamano?: number;
  /** El `blur` en px: 14 en el perfil (doc 20), menos en las filas chicas. */
  desenfoque?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: tamano, height: tamano }}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-tinta text-white ${className}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          style={{ filter: `blur(${desenfoque}px)` }}
          className="h-full w-full scale-125 object-cover"
        />
      ) : (
        <span
          style={{ filter: `blur(${Math.max(2, desenfoque / 3)}px)`, fontSize: tamano / 2.6 }}
          className="font-extrabold"
        >
          {iniciales(nombre)}
        </span>
      )}
    </span>
  );
}
