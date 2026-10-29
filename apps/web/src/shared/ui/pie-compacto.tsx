import Link from 'next/link';

const ENLACES = [
  { href: '/ayuda', texto: 'Ayuda' },
  { href: '/terminos', texto: 'Términos' },
  { href: '/privacidad', texto: 'Privacidad' },
];

/**
 * Pie compacto del lienzo (C_FooterCompacto), para Mensajes y el panel del equipo; el resto
 * lleva `PiePagina`. «Libro de Reclamaciones» sigue sin enlace hasta decidir si aplica a
 * PaseLibre (docs/CHECKLIST.md §4).
 */
export function PieCompacto() {
  return (
    <footer className="border-t border-linea text-nota text-secundario">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-8">
        <nav aria-label="Información" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>© 2026 PaseLibre</span>
          {ENLACES.map(({ href, texto }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-6 items-center text-secundario no-underline hover:text-tinta hover:underline"
            >
              {texto}
            </Link>
          ))}
          <span>Libro de Reclamaciones</span>
        </nav>
        <span>Español (Perú)</span>
      </div>
    </footer>
  );
}
