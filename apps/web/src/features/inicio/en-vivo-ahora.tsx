'use client';

import type { RespuestaYo } from '@paselibre/contracts';
import Link from 'next/link';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';
import { useAhora } from '@/features/en-vivo/datos';
import { BotonResponder } from '@/features/en-vivo/responder';
import { conVendedor, cuantoQueda, etiquetaTipo, type ItemEnVivo } from '@/features/en-vivo/textos';
import { haceRato } from '@/shared/fechas';
import { BotonBrasa, EtiquetaEnVivo } from '@/shared/ui/brasa';

/** Lo que piden o rematan las demás tiendas ahora (sin lo tuyo). */
function useAjenosEnVivo(): { lista: ItemEnVivo[]; listo: boolean; activo: boolean } {
  const compartido = useEnVivoMontado();
  const lista = (compartido?.datos?.en_vivo ?? []).filter(
    (item) => !(conVendedor(item) && item.propio),
  );
  return { lista, listo: Boolean(compartido?.datos), activo: compartido?.activo !== false };
}

/**
 * «HOLA, DARK ALIEN PLANETA · Cyberplaza · Stand 2B 105 · 3 tiendas piden algo ahora» con
 * «Pedir algo en vivo» en Brasa (COR14 y COR25). Sin el «Publicar» repetido: ya está arriba.
 */
export function SaludoTienda({ sesion }: { sesion: RespuestaYo }) {
  const { lista, activo } = useAjenosEnVivo();
  const tienda = sesion.tienda;
  const tiendas = new Set(lista.map((item) => (conVendedor(item) ? item.tienda.nombre : item.id)))
    .size;
  const lugar = [
    tienda?.galeria ?? 'Independiente',
    tienda?.stand && `Stand ${tienda.stand}`,
    tiendas > 0 && `${tiendas} ${tiendas === 1 ? 'tienda pide' : 'tiendas piden'} algo ahora`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <section
      aria-label="Tu tienda"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-linea bg-white px-6 py-5 max-sm:px-4"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="truncate text-[28px] leading-8 max-sm:text-[22px] max-sm:leading-7">
          Hola, {tienda?.nombre ?? sesion.usuario.nombre}
        </h1>
        <span className="text-apoyo text-secundario">{lugar}</span>
      </div>
      {activo && (
        <BotonBrasa href="/pedidos-en-vivo/publicar" className="max-sm:w-full">
          Pedir algo en vivo
        </BotonBrasa>
      )}
    </section>
  );
}

function TarjetaEnVivo({ item, ahora }: { item: ItemEnVivo; ahora: number }) {
  const queda = cuantoQueda(item.vence_en, ahora, true);
  const respuestas = conVendedor(item) ? item.respuestas : 0;
  const linea = [
    conVendedor(item) ? item.tienda.nombre : null,
    haceRato(item.creado_en, new Date(ahora)).toLowerCase(),
    item.tipo === 'BUSCO'
      ? `${respuestas} ${respuestas === 1 ? 'respuesta' : 'respuestas'}`
      : `${respuestas} ${respuestas === 1 ? 'interesado' : 'interesados'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="flex w-[300px] shrink-0 flex-col gap-2 rounded-[20px] border border-linea bg-white p-4 sm:w-auto sm:min-w-0">
      <span className="flex items-center justify-between gap-2">
        <EtiquetaEnVivo />
        <span className="text-nota font-bold text-aviso">
          {queda === 'Venció' ? 'Venció' : `quedan ${queda}`}
        </span>
      </span>
      <span className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-secundario">
        {etiquetaTipo(item.tipo)}
      </span>
      <Link
        href={`/pedidos-en-vivo?id=${item.id}`}
        className="text-[17px] font-bold leading-6 text-tinta no-underline hover:underline"
      >
        {item.titulo}
      </Link>
      <span className="text-apoyo text-secundario">{linea}</span>
      <span className="mt-auto flex items-center gap-2 pt-1">
        <BotonResponder
          item={item}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-contador px-4 text-apoyo font-bold text-tinta no-underline"
        />
        <Link
          href={`/pedidos-en-vivo?id=${item.id}`}
          className="inline-flex h-10 items-center rounded-full border border-tinta px-4 text-apoyo font-bold text-tinta no-underline"
        >
          Ver
        </Link>
      </span>
    </li>
  );
}

/**
 * «PEDIDOS EN VIVO AHORA» del inicio (COR25): hasta 3, lo que vence primero, con «¡Lo tengo!» y
 * «Ver». Sin nada en vivo no se muestra: el saludo ya invita a pedir.
 */
export function PedidosEnVivoAhora() {
  const { lista, listo, activo } = useAjenosEnVivo();
  const ahora = useAhora();
  if (!activo || !listo || lista.length === 0) return null;
  return (
    <section aria-labelledby="en-vivo-ahora" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="en-vivo-ahora" className="tit text-[22px] leading-7">
          Pedidos en vivo ahora
        </h2>
        <Link href="/pedidos-en-vivo" className="text-apoyo font-bold text-pase-texto">
          {lista.length === 1 ? 'Ver ›' : `Ver los ${lista.length} ›`}
        </Link>
      </div>
      <ul className="-mx-4 m-0 flex list-none gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
        {lista.slice(0, 3).map((item) => (
          <TarjetaEnVivo key={item.id} item={item} ahora={ahora} />
        ))}
      </ul>
    </section>
  );
}
