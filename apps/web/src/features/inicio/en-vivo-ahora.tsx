'use client';

import type { RespuestaYo } from '@paselibre/contracts';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { useEnVivoMontado, usePedidosNuevos } from '@/features/en-vivo/contexto';
import { useAhora } from '@/features/en-vivo/datos';
import { conLosNuevosPrimero } from '@/features/en-vivo/nuevos';
import { EtiquetaNuevo } from '@/features/en-vivo/piezas';
import { BotonResponder } from '@/features/en-vivo/responder';
import { conVendedor, cuantoQueda, etiquetaTipo, type ItemEnVivo } from '@/features/en-vivo/textos';
import { haceRato } from '@/shared/fechas';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';
import { BotonBrasa } from '@/shared/ui/brasa';
import { Miniatura } from '@/shared/ui/miniatura';

/**
 * El ancho de cada tarjeta desde la tableta: dos o tres por fila. Va en `cqw` (el ancho de la
 * lista) para que el contenido no se reacomode mientras la tarjeta nueva crece desde 0
 * (doc 19, punto 22). En el celular van una debajo de otra.
 */
const ANCHO_TARJETA = 'sm:w-[calc((100cqw-12px)/2)] lg:w-[calc((100cqw-24px)/3)]';

/** Lo que piden o rematan las demás tiendas ahora (sin lo tuyo). */
function useAjenosEnVivo(): { lista: ItemEnVivo[]; listo: boolean; activo: boolean } {
  const compartido = useEnVivoMontado();
  const lista = (compartido?.datos?.en_vivo ?? []).filter(
    (item) => !(conVendedor(item) && item.propio),
  );
  return { lista, listo: Boolean(compartido?.datos), activo: compartido?.activo !== false };
}

/**
 * «HOLA, DARK ALIEN PLANETA · Cyberplaza · Stand 2B 105» con «Pedir algo en vivo» en Brasa
 * (N16). En el celular el botón va debajo, a lo ancho.
 */
export function SaludoTienda({ sesion }: { sesion: RespuestaYo }) {
  const { activo } = useAjenosEnVivo();
  const tienda = sesion.tienda;
  const nombre = tienda?.nombre ?? sesion.usuario.nombre;
  const lugar = [tienda?.galeria ?? 'Independiente', tienda?.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <section
      aria-label="Tu tienda"
      className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border-[1.5px] border-linea bg-white px-6 py-5 max-sm:px-4 max-sm:py-4"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <AvatarTienda
          nombre={nombre}
          logo={tienda?.logo}
          tamano={52}
          tamanoCelular={44}
          fondo="bg-tinta font-extrabold text-white"
          oculto
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="tit truncate text-[26px] leading-8 max-sm:text-[19px] max-sm:leading-6">
            Hola, {nombre}
          </h1>
          <span className="text-cuerpo text-secundario max-sm:text-apoyo">{lugar}</span>
        </div>
      </div>
      {activo && (
        <BotonBrasa href="/pedidos-en-vivo/publicar" className="max-sm:w-full">
          Pedir algo en vivo
        </BotonBrasa>
      )}
    </section>
  );
}

/** «Quedan 12 min» con su relojito, en naranja oscuro. */
function Queda({ venceEn, ahora }: { venceEn: string; ahora: number }) {
  const queda = cuantoQueda(venceEn, ahora, true);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-extrabold text-[#C2410C]">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      {queda === 'Venció' ? 'Venció' : `Quedan ${queda}`}
    </span>
  );
}

/**
 * Una tarjeta de la banda, con su foto (doc 19, punto 21). La que acaba de entrar (punto 22)
 * crece desde la izquierda, su borde late naranja dos veces y lleva «NUEVO» 10 s; `espera` la
 * hace entrar detrás de otra que llegó junto con ella.
 */
function TarjetaEnVivo({
  item,
  ahora,
  nueva,
  className = '',
}: {
  item: ItemEnVivo;
  ahora: number;
  nueva: { espera: number } | null;
  className?: string;
}) {
  const quien = [
    conVendedor(item) ? item.tienda.nombre : null,
    haceRato(item.creado_en, new Date(ahora)).toLowerCase(),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className={`relative min-w-0 overflow-hidden rounded-[14px] bg-white sm:shrink-0 ${ANCHO_TARJETA} ${
        nueva ? 'entra-en-vivo' : ''
      } ${className}`}
      style={nueva ? ({ '--espera': `${nueva.espera}ms` } as CSSProperties) : undefined}
    >
      <div className={`flex h-full flex-col gap-1.5 p-3.5 text-tinta ${ANCHO_TARJETA}`}>
        <span className="flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${
                item.tipo === 'BUSCO' ? 'bg-pase-medio text-marca' : 'bg-[#FFEDD5] text-aviso'
              }`}
            >
              {etiquetaTipo(item.tipo)}
            </span>
            {nueva && <EtiquetaNuevo espera={nueva.espera + 200} />}
          </span>
          <Queda venceEn={item.vence_en} ahora={ahora} />
        </span>
        <span className="flex items-center gap-2.5">
          <Miniatura
            ruta={item.foto}
            categoria={item.categoria.slug}
            className="h-[46px] w-[46px] rounded-[10px]"
            glifo={30}
            grosor={5}
          />
          <Link
            href={`/pedidos-en-vivo?id=${item.id}`}
            className="line-clamp-2 min-w-0 text-[16px] font-bold leading-6 text-tinta no-underline hover:underline"
          >
            {item.titulo}
          </Link>
        </span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="min-w-0 truncate text-[12px] text-detalle">{quien}</span>
          {/* «¡Lo tengo!» abre el chat directo (N16): si hay una sola publicación que calce. */}
          <BotonResponder
            item={item}
            directo
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-contador px-3.5 text-[13px] font-extrabold text-tinta no-underline"
          />
        </span>
      </div>
    </li>
  );
}

/**
 * «Pedidos en vivo · 3» en el rectángulo negro (N15, N16): hasta 3 en la computadora y 2 en el
 * celular, con «¡Lo tengo!» y «Ver todos ›». Sin nada en vivo, «Aún no hay pedidos en vivo ·
 * Sé el primero…»; con menos de 3, al lado invita a pedir. Nunca queda vacío.
 */
export function PedidosEnVivo() {
  const { lista: ajenos, listo, activo } = useAjenosEnVivo();
  const nuevos = usePedidosNuevos();
  const ahora = useAhora();
  if (!activo) return null;
  // Los que entraron mientras miras van primero: entran por la izquierda y empujan a las demás,
  // que siguen en la fila mientras brillan y salen por la derecha (doc 19, punto 22).
  const lista = conLosNuevosPrimero(ajenos, nuevos.entrados);
  const visibles = lista.slice(0, 3 + nuevos.marcados.size);
  const libres = Math.max(0, 3 - lista.length);
  return (
    <section
      aria-labelledby="pedidos-en-vivo"
      className="flex flex-col gap-3.5 rounded-[22px] bg-tinta p-5 text-white max-sm:p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="pedidos-en-vivo"
          className="flex items-center gap-2 text-[20px] font-extrabold leading-7"
        >
          <span
            aria-hidden="true"
            className="h-[9px] w-[9px] shrink-0 animate-latido rounded-full bg-[#E11D2E]"
          />
          <span>
            Pedidos en vivo
            {lista.length > 0 && (
              <>
                {' · '}
                {/* El número sube con un saltito cuando entra uno (doc 19, punto 22). */}
                <span
                  key={nuevos.lote}
                  className={
                    nuevos.lote > 0
                      ? 'inline-block motion-safe:animate-[sube-numero-en-vivo_450ms_cubic-bezier(.2,1.6,.4,1)]'
                      : undefined
                  }
                >
                  {lista.length}
                </span>
              </>
            )}
          </span>
        </h2>
        {lista.length > 0 && (
          <Link
            href="/pedidos-en-vivo"
            className="text-nota font-extrabold text-acento underline hover:text-acento"
          >
            Ver todos ›
          </Link>
        )}
      </div>
      {!listo ? (
        <div aria-hidden="true" className="h-[118px] rounded-[14px] bg-[#1C2420]" />
      ) : lista.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-[14px] bg-[#1C2420] p-4">
          <b className="text-[16px] font-bold">Aún no hay pedidos en vivo</b>
          <span className="text-nota text-[#B9C4BE]">
            Sé el primero. Lo que pidas les llega al instante a todas las tiendas que lo venden, y
            te responden aquí.
          </span>
          <BotonBrasa
            href="/pedidos-en-vivo/publicar"
            className="mt-1 !h-[42px] self-start !text-[14px]"
          >
            ¿Qué te falta hoy? Pídelo
          </BotonBrasa>
        </div>
      ) : (
        // Alrededor hay aire para el brillo naranja de la que entra.
        <ul className="en-columna -mx-3 -my-3 flex list-none flex-col gap-3 px-3 py-3 [container-type:inline-size] sm:flex-row sm:overflow-hidden">
          {visibles.map((item, n) => (
            <TarjetaEnVivo
              key={item.id}
              item={item}
              ahora={ahora}
              nueva={nuevos.marcados.get(item.id) ?? null}
              className={n >= 2 ? 'max-lg:hidden' : ''}
            />
          ))}
          {libres > 0 && (
            <li className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-dashed border-detalle px-[18px] py-3.5 max-lg:hidden">
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px] font-bold">¿Te falta algo para un cliente?</b>
                <span className="text-nota text-[#B9C4BE]">
                  Pídelo en vivo y te responden en minutos.
                </span>
              </span>
              <BotonBrasa href="/pedidos-en-vivo/publicar" className="!h-10 !px-4 !text-[13px]">
                Pedir algo en vivo
              </BotonBrasa>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
