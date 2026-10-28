import Link from 'next/link';

import { botonPrincipal } from '@/shared/ui/estilos';

export default function NoEncontrada() {
  return (
    <section className="flex max-w-[520px] flex-col items-start gap-3 py-12">
      <h1 className="text-titulo">No encontramos esa página</h1>
      <p className="text-secundario">
        Puede que el producto ya no esté publicado o que la dirección tenga un error.
      </p>
      <Link href="/buscar" className={`${botonPrincipal} no-underline`}>
        Buscar un producto
      </Link>
    </section>
  );
}
