/** Pie compacto del lienzo (C_FooterCompacto). Los enlaces llegan con sus páginas. */
export function PieCompacto() {
  return (
    <footer className="border-t border-linea text-nota text-secundario">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-8">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>© 2026 PaseLibre</span>
          <span>Ayuda</span>
          <span>Términos</span>
          <span>Privacidad</span>
          <span>Libro de Reclamaciones</span>
        </span>
        <span>Español (Perú)</span>
      </div>
    </footer>
  );
}
