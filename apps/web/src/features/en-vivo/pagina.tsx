'use client';

import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { botonPrincipal, campo } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Segmentado } from '@/shared/ui/segmentado';

import { useAhora, useEnVivo } from './datos';
import { LoTuyo } from './lo-tuyo';
import { EtiquetaTipo, PildoraEnVivo, botonResponder } from './piezas';
import { BotonResponder } from './responder';
import {
  conVendedor,
  cuantoQueda,
  datoPrecio,
  lineaCantidad,
  textoCierre,
  type ItemEnVivo,
} from './textos';

type Tipo = 'todo' | 'busco' | 'flash';

function Tarjeta({
  item,
  ahora,
  resaltada,
}: {
  item: ItemEnVivo;
  ahora: number;
  resaltada: boolean;
}) {
  const detalle = [
    conVendedor(item) ? item.tienda.nombre : null,
    item.galeria ?? 'Independiente',
    lineaCantidad(item),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article
      id={`en-vivo-${item.id}`}
      className={`flex scroll-mt-28 flex-col gap-2 rounded-2xl border bg-white p-3.5 ${
        resaltada ? 'border-tinta ring-2 ring-pase-suave' : 'border-linea'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <EtiquetaTipo tipo={item.tipo} />
        <span className="text-nota font-semibold text-aviso">
          {cuantoQueda(item.vence_en, ahora)}
        </span>
      </div>
      <Miniatura
        ruta={item.producto?.foto ?? null}
        categoria={item.categoria.slug}
        className="h-[104px] w-full rounded-xl"
        glifo={80}
        grosor={3.4}
      />
      {item.producto ? (
        <Link
          href={`/p/${item.producto.slug}`}
          className="text-tarjeta no-underline hover:underline"
        >
          {item.titulo}
        </Link>
      ) : (
        <b className="text-tarjeta">{item.titulo}</b>
      )}
      {conVendedor(item) && item.nota && <p className="text-apoyo text-secundario">{item.nota}</p>}
      <span className="text-nota text-detalle">{detalle}</span>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-linea pt-2.5">
        <b className="text-cuerpo font-semibold">{datoPrecio(item)}</b>
        <BotonResponder item={item} className={botonResponder} />
      </div>
    </article>
  );
}

/**
 * `/en-vivo` (EV_Todos, RF-75): todo lo que está en vivo, con filtros por tipo, categoría y
 * galería, los cerrados de hoy y, con sesión, «Lo tuyo en vivo». `?id=` resalta uno (los
 * avisos de la campanita llegan así).
 */
export function PaginaEnVivo({
  conSesion,
  categorias,
  galerias,
  resaltar,
}: {
  conSesion: boolean;
  categorias: CategoriaResumen[];
  galerias: GaleriaResumen[];
  resaltar: string | null;
}) {
  const [tipo, setTipo] = useState<Tipo>('todo');
  const [categoria, setCategoria] = useState('');
  const [galeria, setGaleria] = useState('');
  const consulta = new URLSearchParams({
    tipo,
    ...(categoria ? { categoria } : {}),
    ...(galeria ? { galeria } : {}),
  }).toString();
  const { datos } = useEnVivo(`?${consulta}`);
  const ahora = useAhora();

  useEffect(() => {
    if (!resaltar || !datos) return;
    document.getElementById(`en-vivo-${resaltar}`)?.scrollIntoView({ block: 'center' });
  }, [resaltar, datos]);

  const enVivo = datos?.en_vivo ?? [];
  const cerrados = datos?.cerrados_hoy ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <PildoraEnVivo />
          <h1 className="text-titulo">Busco y ofertas flash</h1>
          {datos && <span className="text-apoyo text-detalle">{enVivo.length} ahora</span>}
        </div>
        <Link
          href={conSesion ? '/en-vivo/publicar' : '/ingresar'}
          className={`${botonPrincipal} no-underline`}
        >
          Publicar en vivo
        </Link>
      </div>
      <p className="-mt-3 max-w-[640px] text-secundario">
        Lo que las tiendas necesitan para un cliente o rematan hoy. Responde antes de que venza: la
        respuesta abre el chat con la tienda.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <Segmentado
          etiqueta="Qué mostrar"
          valor={tipo}
          alCambiar={setTipo}
          opciones={[
            ['todo', 'Todo'],
            ['busco', 'Busco'],
            ['flash', 'Ofertas flash'],
          ]}
        />
        <label className="flex flex-col gap-1 text-nota font-medium text-detalle">
          Categoría
          <select
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value)}
            className={`${campo} h-10 w-auto`}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-nota font-medium text-detalle">
          Galería
          <select
            value={galeria}
            onChange={(evento) => setGaleria(evento.target.value)}
            className={`${campo} h-10 w-auto`}
          >
            <option value="">Todas</option>
            {galerias.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          {!datos && <p className="text-secundario">Cargando…</p>}
          {datos && enVivo.length === 0 && (
            <p className="rounded-2xl bg-superficie p-5 text-secundario">
              Ahora no hay nada en vivo
              {tipo !== 'todo' || categoria || galeria ? ' con esos filtros' : ''}. Publica lo que
              buscas para un cliente y les avisamos a las tiendas que lo tienen.
            </p>
          )}
          {enVivo.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-4">
              {enVivo.map((item) => (
                <Tarjeta key={item.id} item={item} ahora={ahora} resaltada={item.id === resaltar} />
              ))}
            </div>
          )}
          {cerrados.length > 0 && (
            <section aria-labelledby="cerrados" className="flex flex-col gap-2">
              <h2 id="cerrados" className="text-tarjeta">
                Cerrados hoy{' '}
                <span className="text-apoyo font-normal text-detalle">{cerrados.length}</span>
              </h2>
              <ul className="flex flex-col rounded-2xl border border-linea">
                {cerrados.map((item) => (
                  <li
                    key={item.id}
                    id={`en-vivo-${item.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-linea px-4 py-2.5 first:border-t-0"
                  >
                    <EtiquetaTipo tipo={item.tipo} />
                    <b className="min-w-0 flex-1 truncate text-apoyo font-semibold">
                      {item.titulo}
                    </b>
                    <span className="text-nota text-detalle">
                      {conVendedor(item) ? `${item.tienda.nombre} · ` : ''}
                      {item.galeria ?? 'Independiente'}
                    </span>
                    <span className="text-nota font-semibold text-secundario">
                      {textoCierre(item)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        {conSesion && (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col">
            <LoTuyo ahora={ahora} />
          </div>
        )}
      </div>
    </div>
  );
}
