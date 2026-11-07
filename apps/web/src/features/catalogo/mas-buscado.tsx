import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';

/**
 * «Lo más buscado» como chips que buscan con un toque (J). Con `categoria`, la búsqueda se
 * queda dentro de ella. Sin términos no se muestra nada.
 */
export function MasBuscado({
  terminos,
  categoria = null,
  titulo = null,
}: {
  terminos: string[];
  categoria?: string | null;
  titulo?: string | null;
}) {
  if (terminos.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {titulo && <span className="mr-1 text-apoyo text-secundario">{titulo}</span>}
      {terminos.map((termino) => (
        <Link
          key={termino}
          href={`/buscar?${new URLSearchParams({ q: termino, ...(categoria ? { categoria } : {}) })}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-superficie px-3.5 text-apoyo font-medium text-tinta no-underline hover:bg-linea"
        >
          <IconSearch size={14} stroke={1.8} aria-hidden="true" />
          {termino}
        </Link>
      ))}
    </div>
  );
}
