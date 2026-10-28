import type { ReactNode } from 'react';

/** Dibujos de línea del lienzo para cada categoría, cuando el producto aún no tiene fotos. */
const TRAZOS: Record<string, ReactNode> = {
  graficas: (
    <>
      <rect x="4" y="10" width="112" height="44" rx="6" />
      <circle cx="32" cy="32" r="13" />
      <circle cx="60" cy="32" r="13" />
      <circle cx="88" cy="32" r="13" />
      <path d="M14 54v8h40v-8" />
    </>
  ),
  procesadores: (
    <>
      <rect x="38" y="12" width="44" height="48" rx="4" />
      <rect x="49" y="24" width="22" height="24" rx="2" />
      <path d="M46 6v6M56 6v6M64 6v6M74 6v6M46 60v6M56 60v6M64 60v6M74 60v6M32 22h6M32 36h6M32 50h6M82 22h6M82 36h6M82 50h6" />
    </>
  ),
  ram: (
    <>
      <rect x="6" y="20" width="108" height="28" rx="3" />
      <path d="M18 28h14v12H18zM40 28h14v12H40zM66 28h14v12H66zM88 28h14v12H88z" />
      <path d="M14 48v6M24 48v6M34 48v6M44 48v6M54 48v6M70 48v6M80 48v6M90 48v6M100 48v6" />
    </>
  ),
  monitores: (
    <>
      <rect x="18" y="6" width="84" height="50" rx="4" />
      <path d="M60 56v8M44 66h32" />
    </>
  ),
  placas: (
    <>
      <rect x="30" y="4" width="60" height="64" rx="4" />
      <rect x="40" y="14" width="20" height="20" rx="2" />
      <path d="M68 14v44M76 14v44M40 44h20M40 52h20" />
    </>
  ),
  perifericos: (
    <>
      <rect x="6" y="24" width="78" height="30" rx="5" />
      <path d="M14 32h4M24 32h4M34 32h4M44 32h4M54 32h4M64 32h4M74 32h2M14 40h4M24 40h4M34 40h4M44 40h4M54 40h4M64 40h4M24 47h40" />
      <rect x="92" y="20" width="22" height="36" rx="11" />
      <path d="M103 20v11" />
    </>
  ),
  cases: (
    <>
      <rect x="40" y="4" width="40" height="64" rx="4" />
      <circle cx="60" cy="20" r="6" />
      <path d="M48 40h24M48 48h24M48 56h24" />
    </>
  ),
};

export function GlifoCategoria({
  categoria,
  ancho = 40,
  grosor = 4.5,
}: {
  categoria: string;
  ancho?: number;
  /** El trazo se ve igual de fino a cualquier tamaño si baja cuando el dibujo crece. */
  grosor?: number;
}) {
  return (
    <svg
      width={ancho}
      height={(ancho * 72) / 120}
      viewBox="0 0 120 72"
      fill="none"
      stroke="#2E3A5A"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[categoria] ?? TRAZOS.graficas}
    </svg>
  );
}
