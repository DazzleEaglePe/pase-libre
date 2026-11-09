'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Las secciones del panel del equipo; la actual lleva la raya. */
export function SeccionesDelPanel({ porRevisar }: { porRevisar: number }) {
  const ruta = usePathname();
  const secciones = [
    { href: '/equipo/cuentas', texto: 'Cuentas', cuenta: 0 },
    { href: '/equipo/solicitudes', texto: 'Solicitudes', cuenta: porRevisar },
  ];
  return (
    <nav aria-label="Secciones del panel" className="flex items-center gap-5 text-apoyo">
      <span className="font-semibold">Panel del equipo</span>
      {secciones.map(({ href, texto, cuenta }) => {
        const actual = ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actual ? 'page' : undefined}
            className={`flex h-12 items-center gap-1.5 border-b-2 px-1 no-underline ${
              actual ? 'border-acento font-semibold' : 'border-transparent'
            }`}
          >
            {texto}
            {cuenta > 0 && (
              <span className="rounded-full bg-contador px-1.5 text-nota font-semibold text-tinta">
                {cuenta}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
