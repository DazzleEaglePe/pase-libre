'use client';

import type {
  AvisoCampanita,
  CategoriaAviso,
  RespuestaAvisos,
  TipoAviso,
} from '@paselibre/contracts';
import {
  IconAntenna,
  IconBell,
  IconBox,
  IconFlag,
  IconHeart,
  IconMessage,
  IconSearch,
  IconShieldCheck,
  IconStar,
  IconCircleCheck,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { marcarAvisoLeido } from '@/shared/avisos-leidos';
import { haceCuanto, haceRato, hora } from '@/shared/fechas';
import { Miniatura } from '@/shared/ui/miniatura';

export const FILTROS_AVISOS: Array<[CategoriaAviso | 'TODOS', string]> = [
  ['TODOS', 'Todos'],
  ['EN_VIVO', 'En vivo'],
  ['VENTAS', 'Ventas'],
  ['MENSAJES', 'Mensajes'],
  ['PUBLICACIONES', 'Publicaciones'],
  ['CUENTA', 'Cuenta'],
];

/** El ícono de cada tipo, en su círculo (AV_Web). */
function Icono({ tipo }: { tipo: TipoAviso }) {
  const iconos: Record<TipoAviso, [ReactNode, string]> = {
    EN_VIVO: [<IconAntenna key="i" size={16} stroke={1.8} />, 'bg-aviso-fondo text-aviso'],
    EN_VIVO_RESPUESTA: [
      <IconAntenna key="i" size={16} stroke={1.8} />,
      'bg-aviso-fondo text-aviso',
    ],
    MENSAJE: [<IconMessage key="i" size={16} stroke={1.8} />, 'bg-pase-suave text-marca'],
    VENTA: [<IconCircleCheck key="i" size={16} stroke={1.8} />, 'bg-pase-suave text-marca'],
    CALIFICACION: [<IconStar key="i" size={16} stroke={1.8} />, 'bg-ambar text-ambar-texto'],
    RECORDATORIO: [<IconBox key="i" size={16} stroke={1.8} />, 'bg-superficie text-secundario'],
    SEGUIDA: [<IconHeart key="i" size={16} stroke={1.8} />, 'bg-pase-suave text-marca'],
    ALERTA: [<IconSearch key="i" size={16} stroke={1.8} />, 'bg-superficie text-secundario'],
    REPORTE: [<IconFlag key="i" size={16} stroke={1.8} />, 'bg-superficie text-secundario'],
    SEGURIDAD: [<IconShieldCheck key="i" size={16} stroke={1.8} />, 'bg-pase text-white'],
    SISTEMA: [<IconBell key="i" size={16} stroke={1.8} />, 'bg-superficie text-secundario'],
    EQUIPO: [<IconBell key="i" size={16} stroke={1.8} />, 'bg-tinta text-white'],
  };
  const [icono, clase] = iconos[tipo];
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${clase}`}
    >
      {icono}
    </span>
  );
}

/** «Hace 2 min» hoy, «Ayer, 6:00 p. m.» o «9 nov». */
function cuando(iso: string): string {
  const dia = haceCuanto(iso);
  if (dia === 'Hoy') return haceRato(iso);
  if (dia === 'Ayer') return `Ayer, ${hora(iso)}`;
  return dia;
}

/** Nuevos (sin leer), Hoy, Ayer y Antes: los grupos de AV_Web. */
function agrupar(avisos: AvisoCampanita[]): Array<[string, AvisoCampanita[]]> {
  const grupos = new Map<string, AvisoCampanita[]>();
  for (const aviso of avisos) {
    const dia = haceCuanto(aviso.actualizado_en);
    const grupo = !aviso.leido
      ? 'Nuevos'
      : dia === 'Hoy'
        ? 'Hoy'
        : dia === 'Ayer'
          ? 'Ayer'
          : 'Antes';
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), aviso]);
  }
  return ['Nuevos', 'Hoy', 'Ayer', 'Antes']
    .filter((grupo) => grupos.has(grupo))
    .map((grupo) => [grupo, grupos.get(grupo) ?? []]);
}

/**
 * La lista de avisos (AV_Web, AV_WebPanel): por grupos, cada uno con su ícono, el punto
 * naranja si está sin leer y su botón. Tocar el aviso (o su botón) lo marca leído en todos
 * lados al toque (N07, error 36) y abre a donde lleva.
 */
export function ListaAvisos({
  avisos,
  alAbrir,
}: {
  avisos: AvisoCampanita[];
  alAbrir?: () => void;
}) {
  return (
    <div className="flex flex-col">
      {agrupar(avisos).map(([grupo, lista]) => (
        <section key={grupo} aria-label={grupo}>
          <h3 className="px-4 pb-2 pt-4 text-etiqueta uppercase text-detalle">{grupo}</h3>
          <ul className="m-0 list-none p-0">
            {lista.map((aviso) => (
              <li
                key={aviso.id}
                className={`relative flex gap-3 border-t border-linea px-4 py-3.5 ${
                  aviso.leido ? 'bg-white' : 'bg-[#FFFBF5]'
                }`}
              >
                {/* El pedido en vivo llega con su foto (doc 19, punto 21). */}
                {aviso.foto ? (
                  <Miniatura ruta={aviso.foto} categoria="" className="h-11 w-11 rounded-[10px]" />
                ) : (
                  <Icono tipo={aviso.tipo} />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={aviso.enlace ?? '/avisos'}
                    onClick={() => {
                      marcarAvisoLeido(aviso);
                      alAbrir?.();
                    }}
                    className="text-cuerpo text-tinta no-underline after:absolute after:inset-0 hover:underline"
                  >
                    {aviso.titulo}
                    {!aviso.leido && <span className="sr-only"> (sin leer)</span>}
                  </Link>
                  {aviso.extracto && (
                    <span className="text-apoyo text-secundario">{aviso.extracto}</span>
                  )}
                  <span className="text-nota text-detalle">{cuando(aviso.actualizado_en)}</span>
                  {aviso.accion && (
                    <Link
                      href={aviso.accion.enlace}
                      onClick={() => {
                        marcarAvisoLeido(aviso);
                        alAbrir?.();
                      }}
                      className={`relative z-10 mt-2 flex h-9 items-center self-start rounded-full px-3.5 text-apoyo font-bold no-underline ${
                        aviso.accion.tipo === 'LO_TENGO'
                          ? 'bg-contador text-tinta'
                          : 'bg-pase text-white'
                      }`}
                    >
                      {aviso.accion.tipo === 'LO_TENGO' ? '¡Lo tengo!' : aviso.accion.texto}
                    </Link>
                  )}
                </div>
                {!aviso.leido && (
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-contador"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Los filtros con su cuenta de sin leer: «Todos · 4», «En vivo · 2». */
export function FiltrosAvisos({
  datos,
  elegido,
  alElegir,
  todos = true,
}: {
  datos: RespuestaAvisos | null;
  elegido: CategoriaAviso | 'TODOS';
  alElegir: (filtro: CategoriaAviso | 'TODOS') => void;
  /** En la campanita solo van los cuatro primeros, como en el lienzo. */
  todos?: boolean;
}) {
  const filtros = todos ? FILTROS_AVISOS : FILTROS_AVISOS.slice(0, 4);
  return (
    <div
      role="group"
      aria-label="Filtrar avisos"
      className="flex gap-2 overflow-x-auto [scrollbar-width:none]"
    >
      {filtros.map(([clave, texto]) => {
        const cuenta =
          clave === 'TODOS' ? (datos?.sin_leer ?? 0) : (datos?.sin_leer_por_categoria[clave] ?? 0);
        return (
          <button
            key={clave}
            type="button"
            aria-pressed={elegido === clave}
            onClick={() => alElegir(clave)}
            className={`h-10 shrink-0 rounded-full border px-4 text-apoyo ${
              elegido === clave
                ? 'border-tinta bg-tinta font-bold text-white'
                : 'border-borde bg-white font-medium text-tinta'
            }`}
          >
            {texto}
            {cuenta > 0 ? ` · ${cuenta}` : ''}
          </button>
        );
      })}
    </div>
  );
}
