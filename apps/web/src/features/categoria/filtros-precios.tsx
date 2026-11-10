'use client';

import type { RespuestaPreciosCategoria } from '@paselibre/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const ESTADOS: Array<[string, string]> = [
  ['SELLADO', 'Nuevo sellado'],
  ['OPEN_BOX', 'Open box'],
  ['USADO', 'Usado'],
];

/**
 * «Filtrar» de la página de una categoría (CAT_Web4): marca, estado y galería. Cada casilla
 * cambia la dirección (`?marca=MSI,ASUS`) y la tabla se vuelve a pedir.
 */
export function FiltrosPrecios({ filtros }: { filtros: RespuestaPreciosCategoria['filtros'] }) {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();
  const [cargando, iniciar] = useTransition();

  const elegidos = (clave: string) => (actuales.get(clave) ?? '').split(',').filter(Boolean);
  function cambiar(clave: string, valor: string, marcado: boolean) {
    const lista = new Set(elegidos(clave));
    if (marcado) lista.add(valor);
    else lista.delete(valor);
    const parametros = new URLSearchParams(actuales.toString());
    if (lista.size > 0) parametros.set(clave, [...lista].join(','));
    else parametros.delete(clave);
    iniciar(() => router.replace(`${ruta}?${parametros.toString()}`, { scroll: false }));
  }

  const grupos: Array<[string, string, Array<[string, string]>]> = [
    ['marca', 'Marca', filtros.marcas.map((marca) => [marca, marca])],
    ['estado', 'Estado', ESTADOS],
    ['galeria', 'Galería', filtros.galerias.map((galeria) => [galeria.slug, galeria.nombre])],
  ];

  return (
    <div className={`flex flex-col gap-5 ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
      <b className="text-cuerpo font-bold">Filtrar</b>
      {grupos
        .filter(([, , opciones]) => opciones.length > 0)
        .map(([clave, titulo, opciones]) => (
          <fieldset key={clave} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-apoyo font-bold text-secundario">{titulo}</legend>
            {opciones.map(([valor, texto]) => (
              <label key={valor} className="flex min-h-9 items-center gap-3 text-cuerpo">
                <input
                  type="checkbox"
                  checked={elegidos(clave).includes(valor)}
                  onChange={(evento) => cambiar(clave, valor, evento.target.checked)}
                  className="h-5 w-5 accent-pase"
                />
                {texto}
              </label>
            ))}
          </fieldset>
        ))}
    </div>
  );
}
