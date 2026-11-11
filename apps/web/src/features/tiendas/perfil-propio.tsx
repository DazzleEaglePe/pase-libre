'use client';

import {
  formatearPrecio,
  TEXTO_ESTADO_DETALLE,
  type AvisoCampanita,
  type Contadores,
  type OfertaPropia,
  type PerfilTienda,
  type RespuestaAvisos,
  type RespuestaHistorial,
  type RespuestaMisEnVivo,
  type RespuestaMisOfertas,
  type RespuestaOpiniones,
  type ResumenCuenta,
} from '@paselibre/contracts';
import {
  IconAntenna,
  IconBell,
  IconBox,
  IconCamera,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconEye,
  IconLock,
  IconMapPin,
  IconMessage,
  IconPencil,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { EtiquetaTipo } from '@/features/en-vivo/piezas';
import { llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { conPlural, enPlural } from '@/shared/plural';
import { PuntoQueLate } from '@/shared/ui/brasa';
import { Miniatura } from '@/shared/ui/miniatura';

import { ListaOpiniones } from './opiniones';
import { PerfilDeTienda } from './perfil-tienda';

type Pestana = 'publicaciones' | 'reputacion' | 'opiniones' | 'detalles';

/** «Excelente · las tiendas confían en ti»: el nivel y cuántos de 5 tramos se pintan. */
function nivel(estrellas: number | null): [string, number] {
  if (estrellas === null) return ['Todavía sin opiniones', 0];
  if (estrellas >= 4.5) return ['Excelente · las tiendas confían en ti', 5];
  if (estrellas >= 4) return ['Muy buena', 4];
  if (estrellas >= 3.5) return ['Buena', 3];
  if (estrellas >= 2.5) return ['Regular', 2];
  return ['Por mejorar', 1];
}

const TRAMOS = ['bg-[#FBC4C4]', 'bg-[#FCD9A8]', 'bg-[#FDE68A]', 'bg-[#B9EBCF]', 'bg-marca'];

function Tarjeta({
  children,
  titulo,
  enlace,
}: {
  children: ReactNode;
  titulo: string;
  enlace?: [string, string];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold">{titulo}</h2>
        {enlace && (
          <Link href={enlace[0]} className="text-apoyo font-bold text-pase-texto">
            {enlace[1]}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** El ícono de un movimiento reciente (P_WebCuentaD2). */
function iconoDe(tipo: AvisoCampanita['tipo']): [ReactNode, string] {
  if (tipo === 'VENTA')
    return [<IconCheck key="i" size={16} stroke={2.2} />, 'bg-pase-medio text-marca'];
  if (tipo === 'CALIFICACION')
    return [<IconStar key="i" size={16} stroke={1.8} />, 'bg-ambar text-ambar-texto'];
  return [<IconMessage key="i" size={16} stroke={1.8} />, 'bg-pase-suave text-marca'];
}

/**
 * Tu perfil, como dueña (P_WebCuentaD2, P_CuentaD2, sección 14 del lienzo final): la portada,
 * «Publicar en vivo» y «Editar perfil», tu reputación con números, lo que pasó hace poco, tus
 * detalles, «Tu panel» y tus productos con sus vistas y chats. El ojito muestra cómo te ven las
 * demás tiendas.
 */
export function PerfilPropio({ perfil }: { perfil: PerfilTienda }) {
  const [comoCliente, setComoCliente] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('publicaciones');
  const [orden, setOrden] = useState<string>('recientes');
  const [resumen, setResumen] = useState<ResumenCuenta | null>(null);
  const [enVivo, setEnVivo] = useState<RespuestaMisEnVivo | null>(null);
  const [ofertas, setOfertas] = useState<RespuestaMisOfertas | null>(null);
  const [movimientos, setMovimientos] = useState<AvisoCampanita[]>([]);
  const [vendidos, setVendidos] = useState<number | null>(null);
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [opiniones, setOpiniones] = useState<RespuestaOpiniones | null>(null);

  useEffect(() => {
    const nada = () => undefined;
    llamarApi<ResumenCuenta>('/cuenta/resumen').then(setResumen, nada);
    llamarApi<RespuestaMisEnVivo>('/en-vivo/mios').then(setEnVivo, nada);
    llamarApi<RespuestaMisOfertas>('/mis-ofertas?estado=vigentes').then(setOfertas, nada);
    llamarApi<RespuestaAvisos>('/avisos').then(
      (r) =>
        setMovimientos(
          r.avisos
            .filter((a) => ['VENTA', 'CALIFICACION', 'EN_VIVO_RESPUESTA'].includes(a.tipo))
            .slice(0, 3),
        ),
      nada,
    );
    llamarApi<RespuestaHistorial>('/historial?lado=ventas').then(
      (r) => setVendidos(r.conteos.ventas),
      nada,
    );
    llamarApi<Contadores>('/contadores').then(setContadores, nada);
  }, []);

  const cargarOpiniones = useCallback(
    (filtro = 'todas') => {
      llamarApi<RespuestaOpiniones>(`/tiendas/${perfil.id}/opiniones?filtro=${filtro}`).then(
        setOpiniones,
        () => undefined,
      );
    },
    [perfil.id],
  );
  useEffect(() => {
    if (pestana === 'opiniones' && !opiniones) cargarOpiniones();
  }, [pestana, opiniones, cargarOpiniones]);

  if (comoCliente) {
    return (
      <div className="flex flex-col gap-4">
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-white">
          <span className="flex flex-col">
            <b className="font-bold">Así te ven las demás tiendas</b>
            <span className="text-nota text-white/80">
              Tus ventas, estadísticas y botones para editar están ocultos.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setComoCliente(false)}
            className="h-10 rounded-full bg-white px-4 text-apoyo font-bold text-tinta"
          >
            Volver a mi vista
          </button>
        </div>
        <PerfilDeTienda
          perfil={{ ...perfil, propia: false, puede_seguir: false }}
          pestanaInicial="productos"
        />
      </div>
    );
  }

  const estrellas = resumen?.estrellas ?? perfil.reputacion.promedio;
  const [textoNivel, tramos] = nivel(estrellas);
  const destacada = estrellas !== null && estrellas >= 4.5 && perfil.reputacion.opiniones >= 10;
  const lista = ofertas?.ofertas ?? [];
  const categorias = [...new Set(lista.map((o) => o.producto.categoria.nombre))].slice(0, 3);
  const visibles =
    orden === 'vistos'
      ? [...lista].sort((a, b) => b.vistas_semana - a.vistas_semana)
      : orden === 'recientes'
        ? lista
        : lista.filter((o) => o.producto.categoria.nombre === orden);
  const vivos = enVivo?.en_vivo ?? [];
  const lugar = [perfil.galeria ?? 'Independiente', perfil.stand && `Stand ${perfil.stand}`]
    .filter(Boolean)
    .join(' · ');
  const meta = vendidos !== null ? (vendidos >= 10 ? 20 : 10) : 10;
  const medalla = meta === 20 ? 'oro' : 'plata';

  const reputacion = (
    <Tarjeta
      titulo="Reputación"
      enlace={[`/tiendas/${perfil.id}?pestana=opiniones`, 'Ver detalle ›']}
    >
      <span className="grid grid-cols-5 gap-1" aria-hidden="true">
        {TRAMOS.map((color, i) => (
          <span
            key={color}
            className={`h-2 rounded-full ${i < tramos ? color : 'bg-superficie'}`}
          />
        ))}
      </span>
      <b className="text-apoyo font-bold text-pase-texto">{textoNivel}</b>
      <div className="grid grid-cols-3 gap-2">
        {[
          [resumen ? String(resumen.ventas_60) : '—', 'pases cerrados en 60 días'],
          [resumen?.responde_en ? `~${resumen.responde_en} min` : '—', 'para responder'],
          [
            resumen?.respondidos !== null && resumen ? `${resumen.respondidos} %` : '—',
            'chats respondidos',
          ],
        ].map(([valor, texto]) => (
          <span key={texto} className="flex flex-col gap-0.5 rounded-xl bg-superficie p-2.5">
            <b className="text-[18px] font-bold">{valor}</b>
            <span className="text-[12px] leading-4 text-secundario">{texto}</span>
          </span>
        ))}
      </div>
      {vendidos !== null && (
        <span className="flex flex-col gap-1.5 border-t border-linea pt-3">
          <span className="flex items-center justify-between text-nota">
            <b className="flex items-center gap-1 font-bold text-aviso">
              <IconStarFilled size={13} className="text-contador" aria-hidden="true" />
              {destacada ? 'Tienda destacada' : 'Este mes'}
            </b>
            <span className="text-secundario">
              {vendidos} de {meta} para {medalla}
            </span>
          </span>
          <span className="h-2 rounded-full bg-superficie">
            <span
              className="block h-full rounded-full bg-pase"
              style={{ width: `${Math.min(100, Math.round((vendidos / meta) * 100))}%` }}
            />
          </span>
        </span>
      )}
    </Tarjeta>
  );

  const detalles = (
    <Tarjeta titulo="Detalles">
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-apoyo">
        <li className="flex gap-2.5">
          <IconCircleCheck
            size={17}
            stroke={1.8}
            className="mt-0.5 shrink-0 text-pase"
            aria-hidden="true"
          />
          <span>
            <b className="font-bold text-pase-texto">Cuenta verificada</b> por PaseLibre
          </span>
        </li>
        <li className="flex gap-2.5">
          <IconMapPin size={17} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          {lugar}
        </li>
        <li className="flex gap-2.5">
          <IconClock size={17} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          {[
            perfil.horario ?? 'Sin horario todavía',
            resumen?.responde_en && `responde en ~${resumen.responde_en} min`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </li>
        {resumen && resumen.vende.length > 0 && (
          <li className="flex gap-2.5">
            <IconBox size={17} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
            Vende{' '}
            {resumen.vende
              .map((c) => c.toLowerCase())
              .join(', ')
              .replace(/, ([^,]*)$/, ' y $1')}
          </li>
        )}
        <li className="flex gap-2.5">
          <IconLock size={17} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          WhatsApp {resumen?.whatsapp ?? ''} · solo con sesión
        </li>
      </ul>
      <Link
        href="/cuenta/configuracion?seccion=datos"
        className="flex h-10 items-center justify-center rounded-full bg-superficie text-apoyo font-bold text-tinta no-underline"
      >
        Editar detalles
      </Link>
    </Tarjeta>
  );

  const panel: Array<[string, string, ReactNode, number]> = [
    [
      '/mis-publicaciones',
      'Publicaciones',
      <IconBox key="i" size={16} stroke={1.8} />,
      ofertas?.por_revisar ?? 0,
    ],
    ['/pedidos-en-vivo', 'Pedidos en vivo', <IconAntenna key="i" size={16} stroke={1.8} />, 0],
    [
      '/mensajes',
      'Mensajes',
      <IconMessage key="i" size={16} stroke={1.8} />,
      contadores?.mensajes ?? 0,
    ],
    ['/historial', 'Ventas', <IconCheck key="i" size={16} stroke={1.8} />, 0],
    ['/cuenta/socios', 'Socios', <IconUsers key="i" size={16} stroke={1.8} />, 0],
    [
      '/cuenta/configuracion?seccion=privacidad',
      'Privacidad y WhatsApp',
      <IconLock key="i" size={16} stroke={1.8} />,
      0,
    ],
    ['/avisos', 'Avisos', <IconBell key="i" size={16} stroke={1.8} />, contadores?.avisos ?? 0],
  ];

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Tu tienda" className="flex flex-col">
        <div className="relative -mx-4 h-[160px] bg-[linear-gradient(135deg,#006B47,#00875A)] sm:mx-0 sm:h-[240px] sm:rounded-b-[28px] sm:rounded-t-[28px]">
          <button
            type="button"
            onClick={() => setComoCliente(true)}
            aria-label="Ver cómo te ven las demás tiendas"
            title="Ver cómo te ven"
            className="absolute bottom-4 right-4 flex h-11 items-center gap-2 rounded-full bg-tinta/80 px-4 text-apoyo font-bold text-white"
          >
            <IconEye size={18} stroke={1.8} aria-hidden="true" />
            <span className="max-sm:hidden">Así te ven</span>
          </button>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 px-1 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            <span className="relative -mt-16 flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-[6px] border-white bg-marca text-[52px] font-bold text-white sm:-mt-20 sm:h-[150px] sm:w-[150px]">
              {perfil.iniciales}
              <Link
                href="/cuenta/configuracion?seccion=datos"
                aria-label="Cambiar foto"
                className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-superficie text-tinta"
              >
                <IconCamera size={17} stroke={1.8} aria-hidden="true" />
              </Link>
            </span>
            <span className="flex flex-col gap-1 pb-1">
              <span className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-bold leading-9 sm:text-[32px]">{perfil.nombre}</h1>
                {destacada && (
                  <span className="flex h-7 items-center gap-1 rounded-full bg-ambar px-2.5 text-nota font-bold text-ambar-texto">
                    <IconStarFilled size={12} aria-hidden="true" />
                    Tienda destacada
                  </span>
                )}
              </span>
              <span className="text-apoyo text-secundario">
                <b className="font-bold text-tinta">{perfil.seguidores}</b>{' '}
                {perfil.seguidores === 1 ? 'tienda te sigue' : 'tiendas te siguen'} ·{' '}
                <b className="font-bold text-tinta">{perfil.total_productos}</b>{' '}
                {enPlural(perfil.total_productos, 'producto', 'productos')}
                {estrellas !== null && (
                  <>
                    {' '}
                    · <b className="font-bold text-tinta">
                      {estrellas.toLocaleString('es-PE')} ★
                    </b>{' '}
                    de {conPlural(perfil.reputacion.opiniones, 'opinión', 'opiniones')}
                  </>
                )}
              </span>
            </span>
          </div>
          <span className="flex gap-2 pb-1">
            <Link
              href="/pedidos-en-vivo/publicar"
              className="flex h-11 items-center gap-2 rounded-full bg-brasa px-4 text-apoyo font-bold text-tinta no-underline"
            >
              <PuntoQueLate tamano={8} />
              Publicar en vivo
            </Link>
            <Link
              href="/cuenta/configuracion?seccion=datos"
              className="flex h-11 items-center gap-2 rounded-full bg-superficie px-4 text-apoyo font-bold text-tinta no-underline"
            >
              <IconPencil size={16} stroke={1.8} aria-hidden="true" />
              Editar perfil
            </Link>
          </span>
        </div>
        <div
          role="tablist"
          className="mt-4 flex gap-5 overflow-x-auto border-b border-linea px-1 [scrollbar-width:none] sm:px-6"
        >
          {(
            [
              ['publicaciones', `Publicaciones · ${perfil.total_productos}`],
              ['reputacion', 'Reputación'],
              ['opiniones', `Opiniones · ${perfil.reputacion.opiniones}`],
              ['detalles', 'Detalles'],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={pestana === clave}
              onClick={() => setPestana(clave)}
              className={`-mb-px h-12 shrink-0 border-b-[3px] text-apoyo ${
                pestana === clave
                  ? 'border-pase font-bold text-pase-texto'
                  : 'border-transparent font-medium text-secundario'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 max-lg:order-2">
          {reputacion}
          <Tarjeta titulo="Movimiento reciente" enlace={['/avisos', 'Ver todo ›']}>
            {movimientos.length === 0 ? (
              <span className="text-apoyo text-secundario">
                Aquí salen tus ventas y calificaciones.
              </span>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {movimientos.map((aviso) => {
                  const [icono, clase] = iconoDe(aviso.tipo);
                  return (
                    <li key={aviso.id} className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${clase}`}
                      >
                        {icono}
                      </span>
                      <span className="min-w-0 flex-1 text-apoyo">{aviso.titulo}</span>
                      <span className="shrink-0 text-nota text-secundario">
                        {haceRato(aviso.actualizado_en)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
          {detalles}
          <Tarjeta titulo="Tu panel">
            <ul className="m-0 flex list-none flex-col p-0">
              {panel.map(([href, texto, icono, cuenta]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex h-11 items-center gap-3 text-cuerpo text-tinta no-underline hover:underline"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-pase-suave text-marca"
                    >
                      {icono}
                    </span>
                    <span className="flex-1">{texto}</span>
                    {cuenta > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
                        {cuenta}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 max-lg:order-1">
          {pestana === 'reputacion' && <div className="lg:hidden">{reputacion}</div>}
          {pestana === 'detalles' && <div className="lg:hidden">{detalles}</div>}
          {pestana === 'opiniones' ? (
            opiniones ? (
              <ListaOpiniones
                datos={opiniones}
                tienda={perfil.nombre}
                alFiltrar={cargarOpiniones}
              />
            ) : (
              <p className="text-secundario">Cargando…</p>
            )
          ) : (
            <section className="flex flex-col gap-5 rounded-[20px] border border-linea bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3">
                <span className="flex flex-col">
                  <h2 className="flex items-center gap-2 text-[18px] font-bold">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-vivo" />
                    Tus pedidos en vivo{vivos.length > 0 ? ` · ${vivos.length}` : ''}
                  </h2>
                  <span className="text-nota text-secundario">
                    Solo los que publicó {perfil.nombre}. Cada uno se cierra solo cuando termina.
                  </span>
                </span>
                {vivos.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-superficie p-4">
                    <span className="flex flex-col">
                      <b className="text-apoyo font-bold">No tienes pedidos en vivo ahora</b>
                      <span className="text-nota text-secundario">
                        ¿Buscas algo para un cliente o quieres rematar stock? Les llega al toque a
                        las tiendas.
                      </span>
                    </span>
                    <Link
                      href="/pedidos-en-vivo/publicar"
                      className="flex h-10 items-center gap-2 rounded-full bg-brasa px-4 text-apoyo font-bold text-tinta no-underline"
                    >
                      <PuntoQueLate tamano={8} />
                      Publicar en vivo
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {vivos.map((item) => (
                      <Link
                        key={item.id}
                        href={`/pedidos-en-vivo?id=${item.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-linea p-3 text-tinta no-underline hover:border-borde"
                      >
                        <Miniatura
                          ruta={item.producto?.foto ?? null}
                          categoria={item.categoria.slug}
                          className="h-14 w-16 rounded-xl"
                          glifo={40}
                          grosor={4}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="self-start">
                            <EtiquetaTipo tipo={item.tipo} />
                          </span>
                          <b className="truncate text-apoyo font-bold">{item.titulo}</b>
                          <span className="flex items-center justify-between gap-2 text-nota text-secundario">
                            {item.precio && (
                              <b className="rounded-full bg-tinta px-2 py-0.5 text-nota font-bold text-white">
                                {item.tipo === 'BUSCO' ? 'Hasta ' : ''}
                                {formatearPrecio(item.precio)}
                              </b>
                            )}
                            {item.respuestas_recibidas.length}{' '}
                            {item.respuestas_recibidas.length === 1 ? 'respuesta' : 'respuestas'}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[18px] font-bold">
                    Productos · {ofertas?.conteos.vigentes ?? perfil.total_productos}
                  </h2>
                  <Link
                    href="/publicar"
                    className="flex h-10 items-center gap-1.5 rounded-full border border-tinta px-4 text-apoyo font-bold text-tinta no-underline"
                  >
                    <IconPlus size={16} stroke={2.2} aria-hidden="true" />
                    Publicar producto
                  </Link>
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
                  {[
                    ['recientes', 'Más recientes'],
                    ['vistos', 'Más vistos'],
                    ...categorias.map((c) => [c, c]),
                  ].map(([clave, texto]) => (
                    <button
                      key={clave}
                      type="button"
                      aria-pressed={orden === clave}
                      onClick={() => setOrden(clave ?? 'recientes')}
                      className={`h-10 shrink-0 rounded-full border px-4 text-apoyo ${
                        orden === clave
                          ? 'border-tinta bg-tinta font-bold text-white'
                          : 'border-borde bg-white font-medium'
                      }`}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
                {ofertas === null ? (
                  <p className="text-secundario">Cargando…</p>
                ) : (
                  <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
                    {visibles.slice(0, 12).map((oferta: OfertaPropia) => {
                      const precio =
                        oferta.modo_venta === 'FACTURADO' ? oferta.precio_facturado : oferta.precio;
                      return (
                        <li key={oferta.id}>
                          <Link
                            href={`/p/${oferta.producto.slug}?oferta=${oferta.id}`}
                            className="flex h-full flex-col overflow-hidden rounded-2xl border border-linea text-tinta no-underline hover:border-borde"
                          >
                            <Miniatura
                              ruta={oferta.fotos[0]?.ruta ?? oferta.producto.foto}
                              categoria={oferta.producto.categoria.slug}
                              className="aspect-[4/3] w-full"
                              glifo={72}
                              grosor={2.4}
                            />
                            <span className="flex flex-1 flex-col gap-1 p-3">
                              <b className="line-clamp-2 text-apoyo font-bold leading-5">
                                {oferta.producto.titulo}
                              </b>
                              <span className="text-nota text-secundario">
                                {oferta.detalle ? TEXTO_ESTADO_DETALLE[oferta.detalle.estado] : ''}{' '}
                                · {oferta.stock} disp.
                              </span>
                              <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                                <b className="rounded-full bg-tinta px-2.5 py-0.5 text-apoyo font-bold text-white">
                                  {precio ? formatearPrecio(precio) : 'Al interno'}
                                </b>
                                <span className="flex items-center gap-2 text-nota text-secundario">
                                  <span className="flex items-center gap-0.5">
                                    <IconEye size={13} stroke={1.8} aria-hidden="true" />
                                    {oferta.vistas_semana}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <IconMessage size={13} stroke={1.8} aria-hidden="true" />
                                    {oferta.chats_semana}
                                  </span>
                                </span>
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(ofertas?.conteos.vigentes ?? 0) > 12 && (
                  <Link
                    href="/mis-publicaciones"
                    className="self-center text-apoyo font-bold text-pase-texto"
                  >
                    Ver todas en Mis publicaciones ›
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
