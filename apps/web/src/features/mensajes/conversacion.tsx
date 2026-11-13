'use client';

import {
  conNombreDeTienda,
  EVENTOS,
  formatearPrecio,
  TIENDA_RESERVADA,
  type CambiarConversacion,
  type DetalleConversacion,
  type EventoMensajeCambio,
  type EventoMensajeNuevo,
  type EventoMensajeRecibido,
  type EventoMensajeVisto,
  type EventoOfertaStock,
  type EventoPresencia,
  type MensajeChat,
  type RespuestaMensajes,
  type RespuestaPedidoWhatsapp,
  type RespuestaRapida,
  type RespuestaVendido,
} from '@paselibre/contracts';
import {
  IconArrowBackUp,
  IconBrandWhatsapp,
  IconCheck,
  IconMapPin,
  IconPencil,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react';
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
import { VentanaBloquear, VentanaReporte } from '@/features/reportes/ventanas';
import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';
import { cuandoFue, diaDelChat, haceRato } from '@/shared/fechas';
import { useConexionTiempoReal, useEvento, useRespaldo } from '@/shared/tiempo-real';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';
import { Miniatura } from '@/shared/ui/miniatura';

import { Burbuja, type AccionMensaje } from './burbuja';
import { CalificarEnChat } from './calificar-en-chat';
import {
  enlaceWhatsapp,
  estadoDeCheck,
  minutosQueQuedan,
  numeroConPrefijo,
  textoActivo,
} from './estado-chat';
import { MarcarVendido } from './marcar-vendido';

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** La hora de ahora, que se renueva cada medio minuto: «Activo hace…» y «quedan N min» se mueven solos. */
function useAhora(cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(reloj);
  }, [cadaMs]);
  return ahora;
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
        <AvatarTienda
          nombre={otro.tienda.nombre}
          logo={otro.tienda.logo}
          tamano={64}
          letra={20}
          fondo="bg-tinta font-bold text-white"
          oculto
        />
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

/** Botón de la cabecera: «Pedir WhatsApp», o «WhatsApp» si ya te lo compartió (N01). */
function BotonWhatsapp({
  detalle,
  pidiendo,
  alPedir,
}: {
  detalle: DetalleConversacion;
  pidiendo: boolean;
  alPedir: () => void;
}) {
  const { whatsapp } = detalle;
  const clase =
    'flex h-10 shrink-0 items-center gap-2 rounded-full border-[1.5px] border-tinta bg-white px-3.5 text-nota font-bold text-tinta no-underline disabled:border-borde disabled:text-detalle max-sm:w-10 max-sm:justify-center max-sm:border-0 max-sm:px-0';
  if (whatsapp.suyo) {
    return (
      <a
        href={enlaceWhatsapp(whatsapp.suyo)}
        target="_blank"
        rel="noopener noreferrer"
        className={clase}
      >
        <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
        <span className="max-sm:sr-only">WhatsApp</span>
      </a>
    );
  }
  if (!whatsapp.puedes_pedir || detalle.bloqueaste) return null;
  return (
    <button
      type="button"
      disabled={whatsapp.pedido_pendiente || pidiendo}
      title={whatsapp.pedido_pendiente ? 'Ya se lo pediste: esperando que acepte' : undefined}
      onClick={alPedir}
      className={clase}
    >
      <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
      <span className="max-sm:sr-only">Pedir WhatsApp</span>
    </button>
  );
}

/**
 * Una conversación (C_Mensajes, F_MovilChat, N01): quién es y si está activa, «Pedir WhatsApp»,
 * el producto fijo arriba con «Marcar vendido» para quien vende, el historial con los checks y
 * el menú de cada mensaje, y la caja con las respuestas rápidas de su papel y fotos. Todo llega
 * por el socket; al reconectar se vuelve a pedir.
 */
export function Conversacion({
  id,
  puedeMarcarVendido = true,
}: {
  id: string;
  /** El asesor sin el permiso «Marcar vendido» (N12) no ve el botón ni «Deshacer». */
  puedeMarcarVendido?: boolean;
}) {
  const conexion = useConexionTiempoReal();
  const ahora = useAhora();
  const [detalle, setDetalle] = useState<DetalleConversacion | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [vistoHasta, setVistoHasta] = useState<string | null>(null);
  const [recibidoHasta, setRecibidoHasta] = useState<string | null>(null);
  const [rapidas, setRapidas] = useState<RespuestaRapida[]>([]);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState<MensajeChat | null>(null);
  const [respondiendo, setRespondiendo] = useState<MensajeChat | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  // EV_WebNet: sin señal se sigue escribiendo; se envía al volver.
  const [enLinea, setEnLinea] = useState(true);
  const [pendientes, setPendientes] = useState<string[]>([]);
  const [cargadoEn, setCargadoEn] = useState(() => Date.now());
  const [volvio, setVolvio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ventana, setVentana] = useState<'bloquear' | 'denunciar' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [llegar, setLlegar] = useState(false);
  const historial = useRef<HTMLDivElement>(null);
  const alFondo = useRef(true);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  // Lo que estaba escrito antes de editar un mensaje: vuelve al terminar.
  const borradorGuardado = useRef('');

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
      setRecibidoHasta(h.recibido_hasta);
      alFondo.current = true;
      if (d.no_leidos > 0 || d.no_leida) leer();
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 404) setNoExiste(true);
      else setError(e instanceof ErrorApi ? e.message : 'No pudimos abrir la conversación.');
    }
  }, [id, leer]);

  /** El detalle solo (WhatsApp, venta), sin volver a pedir los mensajes. */
  const refrescarDetalle = useCallback(() => {
    void llamarApi<DetalleConversacion>(`/conversaciones/${id}`).then(setDetalle, () => undefined);
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar, conexion]);
  useRespaldo(cargar);

  useEffect(() => {
    llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas').then(setRapidas, () => undefined);
  }, []);

  useEffect(() => {
    setEditando(null);
    setRespondiendo(null);
  }, [id]);

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

  /** Un mensaje que cambió (editado, eliminado, pedido respondido) y las citas que lo muestran. */
  const reemplazar = (mensaje: MensajeChat) =>
    setMensajes((lista) =>
      lista.map((m) => {
        if (m.id === mensaje.id) return { ...mensaje, autor: mensaje.autor ?? m.autor };
        if (m.responde_a?.id === mensaje.id) {
          return {
            ...m,
            responde_a: {
              ...m.responde_a,
              texto: mensaje.texto,
              foto: mensaje.foto,
              eliminado: mensaje.eliminado,
            },
          };
        }
        return m;
      }),
    );

  const quitar = (mensajeId: string) =>
    setMensajes((lista) => lista.filter((m) => m.id !== mensajeId));

  useEvento<EventoMensajeNuevo>(EVENTOS.mensajeNuevo, (evento) => {
    if (evento.conversacion_id !== id) return;
    const { mensaje } = evento;
    agregar(mensaje);
    if (!mensaje.mio && document.visibilityState === 'visible') leer();
    // Una venta marcada o deshecha, o un WhatsApp que llegó: cambian la cabecera y lo que se
    // puede editar.
    if (mensaje.tipo === 'SISTEMA' && !mensaje.mio) void cargar();
    else if (mensaje.tipo === 'WHATSAPP' && !mensaje.mio) refrescarDetalle();
  });
  useEvento<EventoMensajeCambio>(EVENTOS.mensajeCambio, (evento) => {
    if (evento.conversacion_id !== id) return;
    if (evento.mensaje) {
      reemplazar(evento.mensaje);
      if (evento.mensaje.tipo === 'PEDIDO_WHATSAPP') refrescarDetalle();
    } else {
      quitar(evento.mensaje_id);
    }
  });
  useEvento<EventoMensajeVisto>(EVENTOS.mensajeVisto, (evento) => {
    if (evento.conversacion_id === id) setVistoHasta(evento.visto_hasta);
  });
  useEvento<EventoMensajeRecibido>(EVENTOS.mensajeRecibido, (evento) => {
    if (evento.conversacion_id !== id) return;
    setRecibidoHasta((antes) =>
      antes && antes > evento.recibido_hasta ? antes : evento.recibido_hasta,
    );
  });
  useEvento<EventoPresencia>(EVENTOS.presencia, (evento) => {
    setDetalle((d) =>
      d && d.otro.tienda.id && d.otro.tienda.id === evento.tienda_id
        ? {
            ...d,
            otro: {
              ...d.otro,
              en_linea: evento.en_linea,
              ultima_conexion: evento.ultima_conexion ?? d.otro.ultima_conexion,
            },
          }
        : d,
    );
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

  async function enviar(cuerpo: { texto?: string; foto?: string; responde_a?: string }) {
    setEnviando(true);
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChat>(`/conversaciones/${id}/mensajes`, {
        metodo: 'POST',
        cuerpo,
      });
      alFondo.current = true;
      agregar(mensaje);
      setRespondiendo(null);
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo enviar. Vuelve a intentarlo.');
      return false;
    } finally {
      setEnviando(false);
    }
  }

  function terminarEdicion() {
    setEditando(null);
    setBorrador(borradorGuardado.current);
    borradorGuardado.current = '';
  }

  async function guardarEdicion(mensaje: MensajeChat, texto: string) {
    setEnviando(true);
    setError(null);
    try {
      reemplazar(
        await llamarApi<MensajeChat>(`/conversaciones/${id}/mensajes/${mensaje.id}`, {
          metodo: 'PATCH',
          cuerpo: { texto },
        }),
      );
      terminarEdicion();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos editar el mensaje.');
    } finally {
      setEnviando(false);
    }
  }

  async function enviarBorrador(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = borrador.trim();
    if (!texto || enviando) return;
    if (editando) {
      await guardarEdicion(editando, texto);
      return;
    }
    if (!enLinea) {
      setPendientes((lista) => [...lista, texto]);
      setBorrador('');
      return;
    }
    if (await enviar({ texto, ...(respondiendo ? { responde_a: respondiendo.id } : {}) })) {
      setBorrador('');
    }
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
      const texto = editando ? '' : borrador.trim();
      if (
        await enviar({
          foto: foto.ruta,
          ...(texto ? { texto } : {}),
          ...(respondiendo ? { responde_a: respondiendo.id } : {}),
        })
      ) {
        if (!editando) setBorrador('');
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos subir la foto.');
      setEnviando(false);
    }
  }

  /** El menú de cada mensaje (N01): Responder, Copiar, Editar y Eliminar. */
  async function alElegir(m: MensajeChat, accion: AccionMensaje) {
    setError(null);
    if (accion === 'responder') {
      if (editando) terminarEdicion();
      setRespondiendo(m);
      entrada.current?.focus();
      return;
    }
    if (accion === 'copiar') {
      const texto = m.texto ?? (m.whatsapp ? numeroConPrefijo(m.whatsapp) : '');
      navigator.clipboard.writeText(texto).then(
        () => setAviso('Copiado.'),
        () => setError('No pudimos copiar el mensaje.'),
      );
      return;
    }
    if (accion === 'editar') {
      setRespondiendo(null);
      if (!editando) borradorGuardado.current = borrador;
      setEditando(m);
      setBorrador(m.texto ?? '');
      entrada.current?.focus();
      return;
    }
    const para = accion === 'eliminar-todos' ? 'todos' : 'mi';
    try {
      const respuesta = await llamarApi<EventoMensajeCambio>(
        `/conversaciones/${id}/mensajes/${m.id}?para=${para}`,
        { metodo: 'DELETE' },
      );
      if (respuesta.mensaje) reemplazar(respuesta.mensaje);
      else quitar(m.id);
      if (editando?.id === m.id) terminarEdicion();
      if (respondiendo?.id === m.id) setRespondiendo(null);
      setAviso(para === 'todos' ? 'Eliminaste el mensaje para todos.' : 'Lo eliminaste para ti.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos eliminar el mensaje.');
    }
  }

  async function pedirWhatsapp() {
    if (!detalle) return;
    setPidiendo(true);
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChat>(`/conversaciones/${id}/whatsapp/pedido`, {
        metodo: 'POST',
      });
      alFondo.current = true;
      agregar(mensaje);
      setDetalle({ ...detalle, whatsapp: { ...detalle.whatsapp, pedido_pendiente: true } });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos pedirle su WhatsApp.');
    } finally {
      setPidiendo(false);
    }
  }

  async function compartirWhatsapp() {
    setMenu(false);
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChat>(`/conversaciones/${id}/whatsapp`, {
        metodo: 'POST',
      });
      alFondo.current = true;
      agregar(mensaje);
      // Si había un pedido suyo, quedó aceptado.
      setMensajes((lista) =>
        lista.map((m) =>
          m.tipo === 'PEDIDO_WHATSAPP' && !m.mio && m.pedido === 'PENDIENTE'
            ? { ...m, pedido: 'ACEPTADO' }
            : m,
        ),
      );
      setAviso('Le compartiste tu WhatsApp.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos compartir tu WhatsApp.');
    }
  }

  async function responderPedido(m: MensajeChat, aceptar: boolean) {
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaPedidoWhatsapp>(
        `/conversaciones/${id}/whatsapp/pedido/${m.id}`,
        { metodo: 'POST', cuerpo: { aceptar } },
      );
      reemplazar(respuesta.pedido);
      if (respuesta.compartido) {
        alFondo.current = true;
        agregar(respuesta.compartido);
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos responder el pedido.');
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
  const reservada = otro.tienda.nombre === TIENDA_RESERVADA;
  const lugar = [
    otro.tienda.galeria ?? 'Independiente',
    otro.tienda.stand && `Stand ${otro.tienda.stand}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const activo = textoActivo(otro.en_linea, otro.ultima_conexion, ahora);
  // N11: en cada chat, solo las respuestas rápidas del papel que tienes en él.
  const deMiPapel = rapidas.filter((r) => r.papel === detalle.rol);
  const puedePedirAqui =
    detalle.whatsapp.puedes_pedir && !detalle.whatsapp.pedido_pendiente && !detalle.whatsapp.suyo;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section
        aria-label={`Conversación con ${otro.tienda.nombre}`}
        className="relative flex h-[calc(100dvh-160px)] min-h-[480px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border-[1.5px] border-linea lg:h-auto lg:min-h-0 lg:rounded-none lg:border-0"
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
          <AvatarTienda
            nombre={otro.tienda.nombre}
            logo={otro.tienda.logo}
            tamano={44}
            letra={15}
            fondo="bg-tinta font-semibold text-white"
            enLinea={otro.en_linea}
            oculto
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-tarjeta">{otro.tienda.nombre}</b>
            <span className="truncate text-nota text-secundario">
              {otro.en_linea ? <b className="font-bold text-pase-texto">● {activo}</b> : activo}
              {activo && !reservada ? ' · ' : ''}
              {!reservada && lugar}
            </span>
          </span>
          <BotonWhatsapp
            detalle={detalle}
            pidiendo={pidiendo}
            alPedir={() => void pedirWhatsapp()}
          />
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
                  {detalle.whatsapp.puedes_compartir && !detalle.bloqueaste && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void compartirWhatsapp()}
                      className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-left hover:bg-superficie"
                    >
                      <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
                      Compartir mi WhatsApp
                    </button>
                  )}
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
                  {/* Con la otra tienda eliminada (doc 19 §9) ya no hay a quién reportar ni bloquear. */}
                  {!detalle.otra_eliminada && (
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
                  )}
                  {!detalle.otra_eliminada && (
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
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* «Hablan de» (PCH_WebTienda): cada producto con esa tienda es su propio hilo. */}
        <div className="relative flex items-center gap-2 border-b border-linea bg-superficie px-3 py-2.5 sm:px-4">
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
          {puedeMarcarVendido && (
            <MarcarVendido
              detalle={detalle}
              alError={setError}
              alVender={(venta) => {
                alFondo.current = true;
                void cargar();
                setAviso(`Listo: stock ${venta.stock_antes} → ${venta.stock_despues}.`);
              }}
              alDeshacer={(venta: RespuestaVendido) => {
                alFondo.current = true;
                void cargar();
                setAviso(
                  `Deshiciste la venta: stock ${venta.stock_antes} → ${venta.stock_despues}.`,
                );
              }}
            />
          )}
        </div>
        {detalle.en_vivo && (
          <EnVivoEnElChat enVivo={detalle.en_vivo} alCambiar={() => void cargar()} />
        )}

        <div
          ref={historial}
          data-historial
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
                // La publicación de una tienda eliminada (doc 19 §9) ya no existe: no lleva a nada.
                aria-disabled={!oferta.id}
                onClick={(evento) => {
                  if (!oferta.id) evento.preventDefault();
                }}
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
                  <span className="self-center rounded-full bg-pase-suave px-3.5 py-1 text-[12px] font-bold text-marca first-letter:uppercase">
                    {dia}
                  </span>
                )}
                <Burbuja
                  m={m}
                  otro={otro.tienda.nombre}
                  check={
                    m.mio && (m.tipo === 'TEXTO' || m.tipo === 'FOTO')
                      ? estadoDeCheck(m, recibidoHasta, vistoHasta)
                      : null
                  }
                  ahora={ahora}
                  puedesCompartir={detalle.whatsapp.puedes_compartir}
                  alCargarFoto={bajarSiHaceFalta}
                  alElegir={(mensaje, accion) => void alElegir(mensaje, accion)}
                  alResponderPedido={responderPedido}
                  alCompartir={() => void compartirWhatsapp()}
                />
              </Fragment>
            );
          })}
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
            <CalificarEnChat
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

        {detalle.otra_eliminada ? (
          <p className="m-0 border-t border-linea bg-superficie px-4 py-4 text-apoyo text-secundario">
            Esta tienda ya no está en PaseLibre. Tus mensajes quedan aquí, pero ya no se puede
            escribir en este chat.
          </p>
        ) : detalle.bloqueaste ? (
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
            {editando && (
              <div className="flex items-center gap-2.5 rounded-xl bg-superficie px-3 py-2 text-apoyo">
                <IconPencil size={18} stroke={1.8} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-bold">Editando</b>
                  {minutosQueQuedan(editando.cambiable_hasta, ahora) > 0 &&
                    ` · quedan ${minutosQueQuedan(editando.cambiable_hasta, ahora)} min`}
                </span>
                <button
                  type="button"
                  aria-label="Cancelar la edición"
                  onClick={terminarEdicion}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white"
                >
                  <IconX size={18} stroke={1.8} aria-hidden="true" />
                </button>
              </div>
            )}
            {respondiendo && (
              <div className="flex items-center gap-2.5 rounded-xl border-l-4 border-pase bg-superficie px-3 py-2 text-apoyo">
                <IconArrowBackUp size={18} stroke={1.8} className="shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-bold">
                    Respondiendo a {respondiendo.mio ? 'tu mensaje' : otro.tienda.nombre}
                  </b>
                  <span className="truncate text-nota text-secundario">
                    {respondiendo.texto ?? (respondiendo.foto ? 'Foto' : '')}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="No responder a ese mensaje"
                  onClick={() => setRespondiendo(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white"
                >
                  <IconX size={18} stroke={1.8} aria-hidden="true" />
                </button>
              </div>
            )}
            {!editando && (puedePedirAqui || deMiPapel.length > 0) && (
              <div
                aria-label="Respuestas rápidas"
                role="group"
                className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]"
              >
                {puedePedirAqui && (
                  <button
                    type="button"
                    disabled={pidiendo}
                    onClick={() => void pedirWhatsapp()}
                    className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-borde bg-white px-3 text-nota font-semibold"
                  >
                    <IconBrandWhatsapp size={16} stroke={1.8} aria-hidden="true" />
                    Pedir WhatsApp
                  </button>
                )}
                {deMiPapel.map((r) => {
                  // «Nombre de la tienda» se vuelve el nombre de la otra tienda (N11).
                  const texto = conNombreDeTienda(r.texto, reservada ? null : otro.tienda.nombre);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={texto}
                      onClick={() => {
                        // Se escribe en la caja; no se envía sola.
                        setBorrador(texto);
                        entrada.current?.focus();
                      }}
                      className="h-[34px] max-w-[200px] shrink-0 truncate rounded-full border-[1.5px] border-borde bg-white px-3 text-nota font-semibold"
                    >
                      {texto}
                    </button>
                  );
                })}
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
              {!editando && (
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
              )}
              <label className="relative flex min-w-0 flex-1">
                <span className="sr-only">{editando ? 'Editar mensaje' : 'Mensaje'}</span>
                <input
                  ref={entrada}
                  value={borrador}
                  onChange={(evento) => setBorrador(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key !== 'Escape') return;
                    if (editando) terminarEdicion();
                    else setRespondiendo(null);
                  }}
                  placeholder="Escribe un mensaje"
                  maxLength={2000}
                  className={`h-11 min-w-0 flex-1 rounded-full border-[1.5px] px-4 text-cuerpo placeholder:text-detalle sm:pr-[140px] ${
                    borrador.trim() ? 'border-pase' : 'border-borde'
                  }`}
                />
                {borrador.trim() && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-nota text-detalle max-sm:hidden"
                  >
                    Enter para {editando ? 'guardar' : 'enviar'}
                  </span>
                )}
              </label>
              <button
                type="submit"
                aria-label={editando ? 'Guardar' : 'Enviar'}
                disabled={(enviando && enLinea) || !borrador.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pase text-white disabled:bg-superficie disabled:text-borde-control"
              >
                {editando ? (
                  <IconCheck size={20} stroke={2} aria-hidden="true" />
                ) : (
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
                )}
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
            tienda={reservada ? null : otro.tienda.nombre}
            sobre={`Chat · ${otro.tienda.nombre}`}
            alCerrar={() => setVentana(null)}
            alBloquear={() => setDetalle({ ...detalle, bloqueaste: true })}
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
