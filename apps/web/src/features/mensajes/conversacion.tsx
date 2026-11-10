'use client';

import {
  EVENTOS,
  formatearPrecio,
  TIENDA_RESERVADA,
  urlFoto,
  type CambiarConversacion,
  type DetalleConversacion,
  type EventoMensajeNuevo,
  type EventoMensajeVisto,
  type EventoOfertaStock,
  type MensajeChat,
  type RespuestaMensajes,
  type RespuestaRapida,
} from '@paselibre/contracts';
import { IconCheck, IconMapPin, IconStarFilled } from '@tabler/icons-react';
import Link from 'next/link';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { EnVivoEnElChat } from '@/features/en-vivo/en-chat';
import { TarjetaCalificar } from '@/features/tiendas/calificar';
import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';
import { cuandoFue, diaDelChat, hora, haceRato } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { useConexionTiempoReal, useEvento } from '@/shared/tiempo-real';
import { Miniatura } from '@/shared/ui/miniatura';

import { VentanaVendido } from './ventana-vendido';
import { VentanaBloquear, VentanaReporte } from '@/features/reportes/ventanas';

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

function estadoDelOtro(d: DetalleConversacion): string {
  if (d.otro.en_linea) return 'Activo ahora';
  if (d.otro.ultima_conexion) return `Activo ${haceRato(d.otro.ultima_conexion).toLowerCase()}`;
  return '';
}

function lineaDeOferta(d: DetalleConversacion): string {
  const { oferta } = d;
  if (oferta.estado === 'ELIMINADA') return 'Ya no está publicada';
  const precio = oferta.precio ? formatearPrecio(oferta.precio) : 'Al interno';
  const stock =
    oferta.stock === 0
      ? 'Sin stock'
      : oferta.stock === 1
        ? '1 en stock'
        : `${oferta.stock} en stock`;
  return [precio, stock, oferta.estado === 'PAUSADA' && 'Pausada'].filter(Boolean).join(' · ');
}

function Burbuja({ m, alCargarFoto }: { m: MensajeChat; alCargarFoto: () => void }) {
  if (m.tipo === 'SISTEMA') {
    return (
      <div
        role="status"
        className="max-w-[85%] self-center rounded-full bg-ok-fondo px-3.5 py-1.5 text-center text-nota font-semibold text-ok"
      >
        {m.texto}
      </div>
    );
  }
  return (
    <div
      className={`max-w-[80%] px-3.5 py-2.5 sm:max-w-[70%] ${
        m.mio
          ? 'self-end rounded-[18px_18px_6px_18px] bg-tinta text-white'
          : 'self-start rounded-[18px_18px_18px_6px] bg-superficie'
      }`}
    >
      {m.foto && (
        <a href={urlFoto(m.foto)} target="_blank" rel="noopener noreferrer" className="mb-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlFoto(m.foto)}
            alt={m.mio ? 'Foto que enviaste' : 'Foto que te enviaron'}
            onLoad={alCargarFoto}
            className="max-h-[260px] w-[220px] max-w-full rounded-xl object-cover"
          />
        </a>
      )}
      {m.texto && <span className="whitespace-pre-wrap break-words">{m.texto}</span>}
      <span className={`block text-right text-[11px] ${m.mio ? 'text-white/60' : 'text-detalle'}`}>
        {hora(m.creado_en)}
      </span>
    </div>
  );
}

type SobreTienda = NonNullable<DetalleConversacion['sobre_tienda']>;

/** «Cyberplaza · Piso 2 · Stand 118». */
function dondeEsta(sobre: SobreTienda): string {
  return [
    sobre.galeria ? `Galería ${sobre.galeria}` : 'Independiente',
    sobre.piso && (/^\d+$/.test(sobre.piso) ? `Piso ${sobre.piso}` : sobre.piso),
    sobre.stand && `Stand ${sobre.stand}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** «Cómo llegar a Computer Shock» (PCH_WebLlegar): dónde está, cómo se sube y su horario. */
function ComoLlegar({ tienda, sobre }: { tienda: string; sobre: SobreTienda }) {
  return (
    <div className="flex max-w-[420px] flex-col gap-3 self-start rounded-[20px] border border-linea bg-white p-4">
      <b className="flex items-center gap-2 text-cuerpo font-bold">
        <IconMapPin size={18} stroke={1.8} className="text-pase" aria-hidden="true" />
        Cómo llegar a {tienda}
      </b>
      <div
        aria-hidden="true"
        className="grid h-[76px] grid-cols-6 gap-1 rounded-xl bg-superficie p-2"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`rounded ${i === 9 ? 'bg-pase' : 'bg-white'}`} />
        ))}
      </div>
      <span className="flex flex-col gap-1 text-apoyo">
        <b className="font-bold">{dondeEsta(sobre)}</b>
        {sobre.indicaciones && <span className="text-secundario">{sobre.indicaciones}</span>}
        {sobre.horario && <span className="text-secundario">{sobre.horario}</span>}
        {!sobre.indicaciones && !sobre.horario && (
          <span className="text-secundario">
            Pregúntale por aquí cómo llegar: todavía no puso las indicaciones.
          </span>
        )}
      </span>
    </div>
  );
}

/** «✓ Venta cerrada · Computer Shock vendió 1 RTX 3070 a Tienda B · US$ 240» (PCH_WebPorConfirmar). */
function VentaCerrada({
  detalle,
  alReclamar,
}: {
  detalle: DetalleConversacion;
  alReclamar: () => void;
}) {
  const { venta, otro, oferta } = detalle;
  if (!venta) return null;
  const vendedor = venta.mi_lado === 'vendedor' ? 'Vendiste' : `${otro.tienda.nombre} vendió`;
  const aQuien = venta.mi_lado === 'vendedor' ? ` a ${otro.tienda.nombre}` : '';
  const puedeReclamar =
    venta.mi_lado === 'comprador' && new Date(venta.reclamo_hasta).getTime() > Date.now();
  return (
    <div role="status" className="flex gap-3 self-stretch rounded-[20px] bg-pase-medio px-4 py-3.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pase text-white"
      >
        <IconCheck size={18} stroke={2.6} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-apoyo">
        <b className="text-cuerpo font-bold text-marca">Venta cerrada</b>
        <span className="text-secundario">
          {vendedor} 1 {oferta.producto.titulo}
          {aQuien}
          {venta.precio ? ` · ${formatearPrecio(venta.precio)}` : ''} ·{' '}
          {cuandoFue(venta.fecha).toLowerCase()}
        </span>
        {puedeReclamar && (
          <button
            type="button"
            onClick={alReclamar}
            className="self-start text-apoyo font-bold text-marca underline"
          >
            ¿No fue así? Avísanos (48 h)
          </button>
        )}
      </span>
    </div>
  );
}

/** El panel de la derecha (PCH_WebTienda): la tienda, «Cómo llegar» y de qué hablan. */
function PanelTienda({
  detalle,
  alLlegar,
}: {
  detalle: DetalleConversacion;
  alLlegar: () => void;
}) {
  const { otro, sobre_tienda: sobre, hablan_de: hilos } = detalle;
  if (!sobre) return null;
  return (
    <aside
      aria-label={`Sobre ${otro.tienda.nombre}`}
      className="hidden w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-linea p-5 xl:flex"
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-tinta text-[20px] font-bold text-white"
        >
          {iniciales(otro.tienda.nombre)}
        </span>
        <b className="text-[18px] font-bold">{otro.tienda.nombre}</b>
        <span className="text-apoyo text-secundario">
          {[sobre.galeria ?? 'Independiente', sobre.stand && `Stand ${sobre.stand}`]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {sobre.estrellas !== null && (
          <span className="flex items-center gap-1 text-apoyo font-bold text-pase-texto">
            <IconStarFilled size={14} className="text-contador" aria-hidden="true" />
            {sobre.estrellas.toLocaleString('es-PE')} ·{' '}
            {sobre.estrellas >= 4.5
              ? 'reputación excelente'
              : `${sobre.opiniones} ${sobre.opiniones === 1 ? 'opinión' : 'opiniones'}`}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={alLlegar}
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-tinta bg-white font-bold"
      >
        <IconMapPin size={17} stroke={1.8} aria-hidden="true" />
        Cómo llegar
      </button>
      <div className="flex flex-col gap-3 border-t border-linea pt-4">
        <b className="text-apoyo font-bold">En esta conversación</b>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {hilos.map((hilo) => (
            <li key={hilo.conversacion_id}>
              <Link
                href={`/mensajes/${hilo.conversacion_id}`}
                className="flex items-center gap-3 text-tinta no-underline hover:underline"
              >
                <Miniatura
                  ruta={hilo.foto}
                  categoria={hilo.categoria}
                  className="h-10 w-12 rounded-lg"
                  glifo={32}
                  grosor={4}
                />
                <span className="flex min-w-0 flex-col">
                  <b className="truncate text-apoyo font-bold">{hilo.titulo}</b>
                  <span className="text-nota text-secundario">
                    {[
                      hilo.precio && formatearPrecio(hilo.precio),
                      cuandoFue(hilo.actualizada_en).toLowerCase(),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {otro.tienda.id && (
        <Link href={`/tiendas/${otro.tienda.id}`} className="text-apoyo font-bold text-pase-texto">
          Ver su tienda ›
        </Link>
      )}
    </aside>
  );
}

/**
 * Una conversación (C_Mensajes, F_MovilChat): quién es y si está activo, el producto fijo
 * arriba con «Vendido» para quien vende, el historial y la caja con respuestas rápidas y
 * fotos. Los mensajes llegan por el socket; al reconectar se vuelve a pedir todo.
 */
export function Conversacion({ id }: { id: string }) {
  const conexion = useConexionTiempoReal();
  const [detalle, setDetalle] = useState<DetalleConversacion | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [vistoHasta, setVistoHasta] = useState<string | null>(null);
  const [rapidas, setRapidas] = useState<RespuestaRapida[]>([]);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  // EV_WebNet: sin señal se sigue escribiendo; se envía al volver.
  const [enLinea, setEnLinea] = useState(true);
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [cargadoEn, setCargadoEn] = useState(() => Date.now());
  const [volvio, setVolvio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ventana, setVentana] = useState<'bloquear' | 'denunciar' | 'vendido' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [llegar, setLlegar] = useState(false);
  const historial = useRef<HTMLDivElement>(null);
  const alFondo = useRef(true);
  const entradaFoto = useRef<HTMLInputElement>(null);

  const leer = useCallback(() => {
    void llamarApi<DetalleConversacion>(`/conversaciones/${id}`, {
      metodo: 'PATCH',
      cuerpo: { leida: true },
    }).then(setDetalle, () => undefined);
  }, [id]);

  const cargar = useCallback(async () => {
    try {
      const [d, h] = await Promise.all([
        llamarApi<DetalleConversacion>(`/conversaciones/${id}`),
        llamarApi<RespuestaMensajes>(`/conversaciones/${id}/mensajes`),
      ]);
      setDetalle(d);
      setMensajes(h.mensajes);
      setCargadoEn(Date.now());
      setHayMas(h.hay_mas);
      setVistoHasta(h.visto_hasta);
      alFondo.current = true;
      if (d.no_leidos > 0 || d.no_leida) leer();
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 404) setNoExiste(true);
      else setError(e instanceof ErrorApi ? e.message : 'No pudimos abrir la conversación.');
    }
  }, [id, leer]);

  useEffect(() => {
    void cargar();
  }, [cargar, conexion]);

  useEffect(() => {
    llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas').then(setRapidas, () => undefined);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(reloj);
  }, [aviso]);

  // Baja al último mensaje al abrir y cuando llega uno nuevo, salvo que estén leyendo arriba.
  useLayoutEffect(() => {
    const caja = historial.current;
    if (caja && alFondo.current) caja.scrollTop = caja.scrollHeight;
  }, [mensajes]);

  // Una foto cambia de alto al cargar: si estaban al fondo, se vuelve a bajar.
  const bajarSiHaceFalta = () => {
    const caja = historial.current;
    if (caja && alFondo.current) caja.scrollTop = caja.scrollHeight;
  };

  const agregar = (mensaje: MensajeChat) =>
    setMensajes((lista) => (lista.some((m) => m.id === mensaje.id) ? lista : [...lista, mensaje]));

  useEvento<EventoMensajeNuevo>(EVENTOS.mensajeNuevo, (evento) => {
    if (evento.conversacion_id !== id) return;
    agregar(evento.mensaje);
    if (!evento.mensaje.mio && document.visibilityState === 'visible') leer();
  });
  useEvento<EventoMensajeVisto>(EVENTOS.mensajeVisto, (evento) => {
    if (evento.conversacion_id === id) setVistoHasta(evento.visto_hasta);
  });
  useEvento<EventoOfertaStock>(EVENTOS.ofertaStock, (evento) => {
    setDetalle((d) =>
      d && d.oferta.id === evento.oferta_id
        ? {
            ...d,
            oferta: { ...d.oferta, stock: evento.stock },
            puede_vender:
              d.rol === 'vendedor' && d.oferta.estado !== 'ELIMINADA' && evento.stock > 0,
          }
        : d,
    );
  });

  async function anteriores() {
    const primero = mensajes[0];
    if (!primero) return;
    const caja = historial.current;
    const alto = caja?.scrollHeight ?? 0;
    const h = await llamarApi<RespuestaMensajes>(
      `/conversaciones/${id}/mensajes?antes=${encodeURIComponent(primero.creado_en)}`,
    );
    alFondo.current = false;
    setMensajes((lista) => [...h.mensajes, ...lista]);
    setHayMas(h.hay_mas);
    // Mantiene a la vista el mensaje que se estaba leyendo.
    requestAnimationFrame(() => {
      if (caja) caja.scrollTop = caja.scrollHeight - alto;
    });
  }

  async function enviar(cuerpo: { texto?: string; foto?: string }) {
    setEnviando(true);
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChat>(`/conversaciones/${id}/mensajes`, {
        metodo: 'POST',
        cuerpo,
      });
      alFondo.current = true;
      agregar(mensaje);
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo enviar. Vuelve a intentarlo.');
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function enviarBorrador(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = borrador.trim();
    if (!texto || enviando) return;
    if (!enLinea) {
      setPendientes((lista) => [...lista, texto]);
      setBorrador('');
      return;
    }
    if (await enviar({ texto })) setBorrador('');
  }

  // Sin conexión: el aviso arriba y los mensajes en espera; al volver, se envían en orden.
  useEffect(() => {
    setEnLinea(navigator.onLine);
    const apagar = () => setEnLinea(false);
    const prender = () => setEnLinea(true);
    window.addEventListener('offline', apagar);
    window.addEventListener('online', prender);
    return () => {
      window.removeEventListener('offline', apagar);
      window.removeEventListener('online', prender);
    };
  }, []);

  useEffect(() => {
    if (!enLinea || pendientes.length === 0) return;
    let cancelado = false;
    void (async () => {
      for (const texto of pendientes) {
        if (cancelado) return;
        await enviar({ texto });
      }
      if (cancelado) return;
      setPendientes([]);
      setVolvio(true);
      setTimeout(() => setVolvio(false), 4000);
    })();
    return () => {
      cancelado = true;
    };
    // `enviar` cambia en cada render; lo que dispara esto es volver a tener señal.
  }, [enLinea]);

  async function enviarFoto(archivo: File | undefined) {
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setError('Solo fotos JPEG, PNG o WebP.');
      return;
    }
    if (archivo.size > 8 * 1024 * 1024) {
      setError('La foto pesa más de 8 MB.');
      return;
    }
    setEnviando(true);
    try {
      const foto = await subirFoto(archivo);
      const texto = borrador.trim();
      if (await enviar({ foto: foto.ruta, ...(texto ? { texto } : {}) })) setBorrador('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos subir la foto.');
      setEnviando(false);
    }
  }

  async function cambiar(cambios: CambiarConversacion, mensaje: string) {
    setMenu(false);
    try {
      setDetalle(
        await llamarApi<DetalleConversacion>(`/conversaciones/${id}`, {
          metodo: 'PATCH',
          cuerpo: cambios,
        }),
      );
      setAviso(mensaje);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
  }

  async function bloquear(bloquear: boolean) {
    if (!detalle) return;
    setVentana(null);
    setMenu(false);
    try {
      await llamarApi(`/conversaciones/${id}/bloqueo`, { metodo: bloquear ? 'POST' : 'DELETE' });
      setDetalle({ ...detalle, bloqueaste: bloquear });
      setAviso(
        bloquear
          ? `Bloqueaste a ${detalle.otro.tienda.nombre}.`
          : `Desbloqueaste a ${detalle.otro.tienda.nombre}.`,
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos hacerlo.');
    }
  }

  if (noExiste) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-linea p-8 lg:rounded-none lg:border-0 text-center">
        <p className="text-secundario">Esta conversación no existe o no es tuya.</p>
        <Link href="/mensajes" className="font-medium">
          Volver a Mensajes
        </Link>
      </section>
    );
  }
  if (!detalle) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-3xl border-[1.5px] border-linea p-8 lg:rounded-none lg:border-0">
        <p className="text-secundario">{error ?? 'Cargando…'}</p>
      </section>
    );
  }

  const { otro, oferta } = detalle;
  const lugar = [
    otro.tienda.galeria ?? 'Independiente',
    otro.tienda.stand && `Stand ${otro.tienda.stand}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const misMensajes = mensajes.filter((m) => m.mio);
  const ultimoMio = misMensajes[misMensajes.length - 1];
  const visto =
    ultimoMio &&
    mensajes[mensajes.length - 1]?.id === ultimoMio.id &&
    vistoHasta !== null &&
    vistoHasta >= ultimoMio.creado_en;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section
        aria-label={`Conversación con ${otro.tienda.nombre}`}
        className="relative flex h-[calc(100dvh-130px)] min-h-[480px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border-[1.5px] border-linea lg:h-auto lg:min-h-0 lg:rounded-none lg:border-0"
      >
        <div className="flex items-center gap-3 border-b border-linea px-3 py-3 sm:px-4">
          <Link
            href="/mensajes"
            aria-label="Volver a Mensajes"
            className="flex h-11 w-9 shrink-0 items-center justify-center lg:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <span
            aria-hidden="true"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white"
          >
            {iniciales(otro.tienda.nombre)}
            {otro.en_linea && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-ok" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-tarjeta">{otro.tienda.nombre}</b>
            <span className="truncate text-nota text-secundario">
              {[otro.nombre !== otro.tienda.nombre && otro.nombre, estadoDelOtro(detalle), lugar]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <div className="relative">
            <button
              type="button"
              aria-label="Más opciones"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${menu ? 'bg-superficie' : ''}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menu && (
              <>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  tabIndex={-1}
                  onClick={() => setMenu(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-20 flex w-[240px] flex-col rounded-2xl border border-linea bg-white p-1.5 text-apoyo shadow-[0_18px_40px_rgba(20,22,26,0.16)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => cambiar({ leida: false }, 'Marcada como no leída.')}
                    className="min-h-11 rounded-[10px] px-3 text-left hover:bg-superficie"
                  >
                    Marcar como no leído
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      cambiar(
                        { silenciada: !detalle.silenciada },
                        detalle.silenciada ? 'Avisos activados.' : 'Conversación silenciada.',
                      )
                    }
                    className="min-h-11 rounded-[10px] px-3 text-left hover:bg-superficie"
                  >
                    {detalle.silenciada ? 'Activar avisos' : 'Silenciar'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      cambiar(
                        { archivada: !detalle.archivada },
                        detalle.archivada
                          ? 'Volvió a tus conversaciones.'
                          : 'Conversación archivada.',
                      )
                    }
                    className="min-h-11 rounded-[10px] px-3 text-left hover:bg-superficie"
                  >
                    {detalle.archivada ? 'Desarchivar' : 'Archivar'}
                  </button>
                  {detalle.otro.tienda.id && (
                    <Link
                      role="menuitem"
                      href={`/tiendas/${detalle.otro.tienda.id}`}
                      className="flex min-h-11 items-center rounded-[10px] px-3 text-tinta no-underline hover:bg-superficie"
                    >
                      Ver perfil de {detalle.otro.tienda.nombre}
                    </Link>
                  )}
                  {detalle.sobre_tienda && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        setLlegar(true);
                        alFondo.current = true;
                        requestAnimationFrame(bajarSiHaceFalta);
                      }}
                      className="min-h-11 rounded-[10px] px-3 text-left hover:bg-superficie"
                    >
                      Cómo llegar
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      setVentana('denunciar');
                    }}
                    className="flex min-h-11 flex-col justify-center rounded-[10px] px-3 py-1.5 text-left hover:bg-superficie"
                  >
                    Reportar a {detalle.otro.tienda.nombre}
                    <span className="text-nota text-secundario">
                      Estafa, no cumplió con lo descrito o mal trato
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (detalle.bloqueaste) {
                        void bloquear(false);
                        return;
                      }
                      setMenu(false);
                      setVentana('bloquear');
                    }}
                    className="min-h-11 rounded-[10px] px-3 text-left font-semibold text-error hover:bg-superficie"
                  >
                    {detalle.bloqueaste
                      ? 'Desbloquear'
                      : `Bloquear a ${detalle.otro.tienda.nombre}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* «Hablan de» (PCH_WebTienda): cada producto con esa tienda es su propio hilo. */}
        <div className="flex items-center gap-2 border-b border-linea bg-superficie px-3 py-2.5 sm:px-4">
          <span className="shrink-0 text-nota font-bold text-secundario">Hablan de</span>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
            {detalle.hablan_de.map((hilo) => {
              const actual = hilo.conversacion_id === id;
              const contenido = (
                <>
                  <Miniatura
                    ruta={hilo.foto}
                    categoria={hilo.categoria}
                    className="h-6 w-8 rounded-md"
                    glifo={22}
                    grosor={5}
                  />
                  <span className="max-w-[180px] truncate">{hilo.titulo}</span>
                  {hilo.precio && <span>· {formatearPrecio(hilo.precio)}</span>}
                </>
              );
              const clase = `flex h-10 shrink-0 items-center gap-2 rounded-full border-2 bg-white px-3 text-nota font-bold no-underline ${
                actual ? 'border-tinta text-tinta' : 'border-linea text-tinta hover:border-borde'
              }`;
              return actual ? (
                <span key={hilo.conversacion_id} aria-current="true" className={clase}>
                  {contenido}
                </span>
              ) : (
                <Link
                  key={hilo.conversacion_id}
                  href={`/mensajes/${hilo.conversacion_id}`}
                  className={clase}
                >
                  {contenido}
                </Link>
              );
            })}
          </div>
          {detalle.rol === 'vendedor' &&
            (detalle.puede_vender ? (
              <button
                type="button"
                onClick={() => setVentana('vendido')}
                className="h-9 shrink-0 rounded-full bg-tinta px-3.5 text-nota font-bold text-white"
              >
                Vendido
              </button>
            ) : (
              oferta.stock === 0 && (
                <Link href="/mis-publicaciones" className="shrink-0 text-nota font-bold">
                  Reponer stock
                </Link>
              )
            ))}
        </div>
        {detalle.en_vivo && (
          <EnVivoEnElChat enVivo={detalle.en_vivo} alCambiar={() => void cargar()} />
        )}

        <div
          ref={historial}
          onScroll={(evento) => {
            const caja = evento.currentTarget;
            alFondo.current = caja.scrollHeight - caja.scrollTop - caja.clientHeight < 80;
          }}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-4 sm:px-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {hayMas && (
            <button
              type="button"
              onClick={() => void anteriores()}
              className="self-center text-nota font-medium underline"
            >
              Ver mensajes anteriores
            </button>
          )}
          {!hayMas && (
            <div className="flex flex-col items-center gap-1.5 self-stretch">
              <span className="text-nota text-detalle">
                {detalle.rol === 'comprador' ? 'Preguntaste por' : 'Te preguntaron por'}
              </span>
              <Link
                href={`/p/${oferta.producto.slug}?oferta=${oferta.id}`}
                className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl border border-linea bg-white p-3 text-tinta no-underline hover:border-borde"
              >
                <Miniatura
                  ruta={oferta.producto.foto}
                  categoria={oferta.producto.categoria.slug}
                  className="h-12 w-16 rounded-xl"
                  glifo={36}
                  grosor={4}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <b className="truncate text-apoyo font-bold">{oferta.producto.titulo}</b>
                  <span className="flex items-center gap-2 text-nota text-secundario">
                    {oferta.precio && (
                      <b className="rounded-full bg-tinta px-2 py-0.5 text-nota font-bold text-white">
                        {formatearPrecio(oferta.precio)}
                      </b>
                    )}
                    {lineaDeOferta(detalle).replace(/^[^·]*·\s?/, oferta.precio ? '' : '$&')}
                  </span>
                </span>
              </Link>
            </div>
          )}
          {mensajes.length === 0 && (
            <p className="my-auto self-center text-center text-apoyo text-secundario">
              {detalle.rol === 'comprador'
                ? `Escríbele a ${otro.tienda.nombre} por este producto.`
                : 'Todavía no hay mensajes.'}
            </p>
          )}
          {mensajes.map((m, indice) => {
            const dia = diaDelChat(m.creado_en);
            const anterior = mensajes[indice - 1];
            return (
              <Fragment key={m.id}>
                {(!anterior || diaDelChat(anterior.creado_en) !== dia) && (
                  <span className="self-center text-[12px] text-detalle first-letter:uppercase">
                    {dia}
                  </span>
                )}
                <Burbuja m={m} alCargarFoto={bajarSiHaceFalta} />
              </Fragment>
            );
          })}
          {visto && pendientes.length === 0 && (
            <span className="self-end text-[12px] text-detalle">Visto</span>
          )}
          {pendientes.map((texto, indice) => (
            <div
              key={`${indice}-${texto}`}
              className="flex max-w-[78%] flex-col items-end gap-0.5 self-end"
            >
              <span className="rounded-2xl rounded-br-md bg-pase-medio px-3.5 py-2 text-cuerpo text-tinta opacity-70">
                {texto}
              </span>
              <span className="text-[12px] text-detalle">Se envía cuando vuelva la señal</span>
            </div>
          ))}
          {detalle.venta && (
            <VentaCerrada detalle={detalle} alReclamar={() => setVentana('denunciar')} />
          )}
          {detalle.venta && !detalle.venta.calificaste && (
            <TarjetaCalificar
              ventaId={detalle.venta.id}
              tienda={otro.tienda.nombre}
              deVendedor={detalle.venta.mi_lado === 'comprador'}
              alTerminar={() => {
                setDetalle({
                  ...detalle,
                  venta: detalle.venta && { ...detalle.venta, calificaste: true },
                });
                setAviso('Gracias: tu opinión suma a su reputación.');
              }}
            />
          )}
          {llegar && detalle.sobre_tienda && (
            <ComoLlegar tienda={otro.tienda.nombre} sobre={detalle.sobre_tienda} />
          )}
        </div>

        {!enLinea && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 border-t border-linea bg-aviso-fondo px-4 py-2.5"
          >
            <span className="text-apoyo">
              <b className="font-bold text-aviso">Sin conexión</b> · Ves lo último que cargó, de{' '}
              {haceRato(new Date(cargadoEn).toISOString()).toLowerCase()}.
            </span>
            <button
              type="button"
              onClick={() => {
                if (navigator.onLine) {
                  setEnLinea(true);
                  void cargar();
                }
              }}
              className="h-9 shrink-0 rounded-full border border-borde bg-white px-3.5 text-nota font-bold"
            >
              Reintentar
            </button>
          </div>
        )}
        {volvio && (
          <p
            role="status"
            className="border-t border-linea bg-pase-suave px-4 py-2.5 text-apoyo font-semibold text-marca"
          >
            Conectado otra vez · se envió tu mensaje
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="border-t border-linea bg-error-fondo px-4 py-2.5 text-apoyo text-error"
          >
            {error}
          </p>
        )}

        {detalle.bloqueaste ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-linea bg-error-fondo px-4 py-4 text-apoyo text-error">
            <span>
              Bloqueaste a {otro.tienda.nombre}. No puede escribirte ni contactarte desde su tienda.
            </span>
            <button
              type="button"
              onClick={() => void bloquear(false)}
              className="h-10 rounded-full border-[1.5px] border-error px-3.5 font-semibold"
            >
              Desbloquear
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 border-t border-linea p-3">
            {rapidas.length > 0 && (
              <div
                aria-label="Respuestas rápidas"
                className="flex gap-1.5 overflow-x-auto sm:flex-wrap"
              >
                {rapidas.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={enviando}
                    onClick={() => void enviar({ texto: r.texto })}
                    className="h-[34px] shrink-0 rounded-full border-[1.5px] border-borde bg-white px-3 text-nota font-semibold"
                  >
                    {r.texto}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={enviarBorrador} className="flex items-center gap-2">
              <input
                ref={entradaFoto}
                type="file"
                accept={TIPOS_FOTO.join(',')}
                hidden
                aria-label="Elegir foto"
                onChange={(evento) => {
                  void enviarFoto(evento.target.files?.[0]);
                  evento.target.value = '';
                }}
              />
              <button
                type="button"
                aria-label="Enviar foto"
                disabled={enviando}
                onClick={() => entradaFoto.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-superficie"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </button>
              <label className="flex min-w-0 flex-1">
                <span className="sr-only">Mensaje</span>
                <input
                  value={borrador}
                  onChange={(evento) => setBorrador(evento.target.value)}
                  placeholder="Escribe un mensaje"
                  maxLength={2000}
                  className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-borde px-4 text-cuerpo placeholder:text-detalle"
                />
              </label>
              <button
                type="submit"
                aria-label="Enviar"
                disabled={(enviando && enLinea) || !borrador.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pase text-white disabled:bg-superficie disabled:text-borde-control"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12l16-8-6 16-2.5-6.5z" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {aviso && (
          <div
            role="status"
            className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-5 py-3.5 text-cuerpo font-semibold text-white shadow-[0_12px_30px_rgba(20,22,26,0.3)]"
          >
            {aviso}
          </div>
        )}

        {ventana === 'bloquear' && (
          <VentanaBloquear
            tienda={otro.tienda.nombre}
            alCerrar={() => setVentana(null)}
            alBloquear={async () => {
              await llamarApi(`/conversaciones/${id}/bloqueo`, { metodo: 'POST' });
              setDetalle({ ...detalle, bloqueaste: true });
              setAviso(`Bloqueaste a ${otro.tienda.nombre}.`);
            }}
            alReportar={() => setVentana('denunciar')}
          />
        )}
        {ventana === 'denunciar' && (
          <VentanaReporte
            objeto="CONVERSACION"
            objetoId={id}
            conversacionId={id}
            tienda={otro.tienda.nombre === TIENDA_RESERVADA ? null : otro.tienda.nombre}
            sobre={`Chat · ${otro.tienda.nombre}`}
            alCerrar={() => setVentana(null)}
            alBloquear={() => setDetalle({ ...detalle, bloqueaste: true })}
          />
        )}

        {detalle.rol === 'vendedor' && (
          <VentanaVendido
            abierta={ventana === 'vendido'}
            ofertaId={oferta.id}
            conversacionId={id}
            producto={oferta.producto.titulo}
            stock={oferta.stock}
            alCerrar={() => setVentana(null)}
            alVender={(venta, vendidaEn) => {
              setVentana(null);
              alFondo.current = true;
              setDetalle({
                ...detalle,
                oferta: { ...oferta, stock: venta.stock_despues },
                puede_vender: venta.stock_despues > 0,
              });
              if (vendidaEn === id) agregar(venta.mensaje);
              setAviso(`Listo: stock ${venta.stock_antes} → ${venta.stock_despues}.`);
            }}
          />
        )}
      </section>
      <PanelTienda
        detalle={detalle}
        alLlegar={() => {
          setLlegar(true);
          alFondo.current = true;
          requestAnimationFrame(bajarSiHaceFalta);
        }}
      />
    </div>
  );
}
