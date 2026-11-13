'use client';

import {
  EVENTOS,
  type Contadores,
  type EventoMensajeNuevo,
  type RespuestaAvisosCuenta,
} from '@paselibre/contracts';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, type RefObject } from 'react';

import { usePedidosNuevos } from '@/features/en-vivo/contexto';
import { llamarApi } from '@/shared/api/cliente';
import {
  CAMBIO_DE_TITULO_MS,
  chatALaVista,
  puedeSonar,
  tituloDeLaPestana,
  type HorarioSilencioso,
  type Sonido,
} from '@/shared/que-no-se-pierda';
import { useEvento } from '@/shared/tiempo-real';

/**
 * Cuando Configuración › Avisos guarda, avisa con este evento del navegador (con la respuesta de
 * `PUT /cuenta/avisos`): así el interruptor «Sonido» vale al toque, sin recargar.
 */
export const EVENTO_AVISOS_GUARDADOS = 'paselibre:avisos-guardados';

/** El último sonido de cualquier pestaña: entre todas, uno cada 3 s como mucho. */
const CLAVE_ULTIMO_SONIDO = 'paselibre:ultimo-sonido';
/** La pestaña escondida espera un poco antes de sonar: si otra está a la vista, suena esa. */
const ESPERA_ESCONDIDA_MS = 150;

function leerUltimo(): number {
  try {
    return Number(localStorage.getItem(CLAVE_ULTIMO_SONIDO)) || 0;
  } catch {
    return 0;
  }
}

function guardarUltimo(cuando: number): void {
  try {
    localStorage.setItem(CLAVE_ULTIMO_SONIDO, String(cuando));
  } catch {
    // Navegación privada: cada pestaña cuenta sola.
  }
}

/** WebM (Opus) si el navegador lo toca; si no (Safari viejo), el WAV de respaldo. */
function rutaDelSonido(sonido: Sonido): string {
  const prueba = document.createElement('audio');
  const webm = prueba.canPlayType('audio/webm; codecs="opus"') !== '';
  return `/sonidos/${sonido}.${webm ? 'webm' : 'wav'}`;
}

/** El primer clic o tecla en la página deja sonar (lo exige el navegador). */
function useAudioDesbloqueado(): RefObject<boolean> {
  const desbloqueado = useRef(false);
  useEffect(() => {
    // Si ya hubo un clic en esta página (se pasó de una sección a otra), ya está desbloqueado.
    const activacion = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    if (activacion?.hasBeenActive) {
      desbloqueado.current = true;
      return;
    }
    const desbloquear = () => {
      desbloqueado.current = true;
      quitar();
    };
    const quitar = () => {
      window.removeEventListener('pointerdown', desbloquear, true);
      window.removeEventListener('keydown', desbloquear, true);
    };
    window.addEventListener('pointerdown', desbloquear, true);
    window.addEventListener('keydown', desbloquear, true);
    return quitar;
  }, []);
  return desbloqueado;
}

interface Preferencias {
  sonido: boolean;
  noMolestar: HorarioSilencioso | null;
}

/** «Sonido» y «No molestar» de Configuración › Avisos; al guardar allí, cambian aquí. */
function usePreferencias(): RefObject<Preferencias | null> {
  const preferencias = useRef<Preferencias | null>(null);
  useEffect(() => {
    const usar = (respuesta: RespuestaAvisosCuenta) => {
      preferencias.current = {
        // Una API anterior sin el campo: prendido, como viene de entrada.
        sonido: respuesta.sonido ?? true,
        noMolestar: respuesta.no_molestar,
      };
    };
    llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos').then(usar, () => undefined);
    const alGuardar = (evento: Event) =>
      usar((evento as CustomEvent<RespuestaAvisosCuenta>).detail);
    window.addEventListener(EVENTO_AVISOS_GUARDADOS, alGuardar);
    return () => window.removeEventListener(EVENTO_AVISOS_GUARDADOS, alGuardar);
  }, []);
  return preferencias;
}

/**
 * La pestaña escondida avisa (doc 19, punto 22, animación D): el título se alterna cada 1,5 s
 * entre «(N) Mensajes · PaseLibre» y «💬 {tienda} te escribió», y el favicon lleva un punto
 * naranja. Al volver a la pestaña, todo vuelve a lo normal.
 */
function usePestanaQueAvisa(): (remitente: string | null) => void {
  const original = useRef<{ titulo: string; iconos: Array<[HTMLLinkElement, string]> } | null>(
    null,
  );
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const datos = useRef({ paso: 0, sinLeer: 1, remitente: null as string | null });

  const restaurar = useCallback(() => {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    const antes = original.current;
    original.current = null;
    if (!antes) return;
    document.title = antes.titulo;
    for (const [enlace, href] of antes.iconos) enlace.href = href;
  }, []);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') restaurar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      restaurar();
    };
  }, [restaurar]);

  return useCallback((remitente: string | null) => {
    if (document.visibilityState === 'visible') return;
    datos.current.remitente = remitente;
    // Cuántos chats quedan sin leer, para «(N) Mensajes».
    llamarApi<Contadores>('/contadores').then(
      (contadores) => {
        datos.current.sinLeer = contadores.mensajes;
      },
      () => undefined,
    );
    if (original.current) return;
    const iconos = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')).map(
      (enlace): [HTMLLinkElement, string] => [enlace, enlace.href],
    );
    original.current = { titulo: document.title, iconos };
    datos.current.paso = 0;
    const mostrar = () => {
      const { paso, sinLeer, remitente: quien } = datos.current;
      document.title = tituloDeLaPestana(paso, sinLeer, quien);
      datos.current.paso = paso + 1;
    };
    mostrar();
    reloj.current = setInterval(mostrar, CAMBIO_DE_TITULO_MS);
    void faviconConPunto(iconos).then((punto) => {
      // Si volvió a la pestaña mientras se dibujaba, no se cambia nada.
      if (!punto || !original.current) return;
      for (const [enlace] of iconos) enlace.href = punto;
    });
  }, []);
}

/** El ícono de PaseLibre (`icon.svg`) con un punto naranja arriba a la derecha, dibujado con canvas. */
async function faviconConPunto(iconos: Array<[HTMLLinkElement, string]>): Promise<string | null> {
  try {
    const svg = iconos.find(([enlace]) => enlace.type === 'image/svg+xml')?.[1] ?? '/icon.svg';
    const imagen = new Image();
    imagen.src = svg;
    await imagen.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = 64;
    lienzo.height = 64;
    const pincel = lienzo.getContext('2d');
    if (!pincel) return null;
    pincel.drawImage(imagen, 0, 0, 64, 64);
    pincel.beginPath();
    pincel.arc(49, 15, 13, 0, Math.PI * 2);
    pincel.fillStyle = '#F97316';
    pincel.fill();
    pincel.lineWidth = 4;
    pincel.strokeStyle = '#FFFFFF';
    pincel.stroke();
    return lienzo.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Que no se pierda nada (doc 19, punto 22). Va una vez por página, dentro del tiempo real y de
 * En vivo (los layouts del catálogo y del vendedor, y `MarcoPagina`), y no dibuja nada:
 *
 * - Llega un mensaje y no estás mirando ese chat: suena M3 («marimba de dos notas») y, con la
 *   pestaña escondida, avisa en el título y en el favicon.
 * - Entra un pedido en vivo de otra tienda: suena V6 («tres notas de marimba»), una sola vez
 *   aunque lleguen varios. La banda y la tarjeta mini lo hacen brillar por su cuenta.
 *
 * El sonido no suena con el chat abierto y a la vista, más de una vez cada 3 s (entre todas las
 * pestañas), en «No molestar» ni con «Sonido» apagado; y no antes del primer clic en la página,
 * sin error.
 */
export function QueNoSePierda() {
  const ruta = usePathname();
  const rutaActual = useRef(ruta);
  rutaActual.current = ruta;
  const desbloqueado = useAudioDesbloqueado();
  const preferencias = usePreferencias();
  const avisarEnLaPestana = usePestanaQueAvisa();
  const audios = useRef<Partial<Record<Sonido, HTMLAudioElement>>>({});

  const sonar = useCallback(
    (sonido: Sonido) => {
      const tocar = () => {
        const actuales = preferencias.current;
        const ahora = Date.now();
        const estado = {
          activo: actuales?.sonido ?? false,
          noMolestar: actuales?.noMolestar ?? null,
          desbloqueado: desbloqueado.current,
          ultimo: leerUltimo(),
        };
        if (!puedeSonar(estado, ahora)) return;
        guardarUltimo(ahora);
        let audio = audios.current[sonido];
        if (!audio) {
          audio = new Audio(rutaDelSonido(sonido));
          audios.current[sonido] = audio;
        }
        audio.currentTime = 0;
        // Si el navegador igual no deja (otra política, sin parlantes), no pasa nada.
        audio.play().catch(() => undefined);
      };
      if (document.visibilityState === 'visible') tocar();
      else setTimeout(tocar, ESPERA_ESCONDIDA_MS);
    },
    [desbloqueado, preferencias],
  );

  useEvento<EventoMensajeNuevo>(EVENTOS.mensajeNuevo, (evento) => {
    if (evento.mensaje.mio) return;
    const visible = document.visibilityState === 'visible';
    if (chatALaVista(rutaActual.current, visible, evento.conversacion_id)) return;
    sonar('mensaje');
    if (!visible) avisarEnLaPestana(evento.remitente ?? null);
  });

  // Entró un pedido en vivo de otra tienda (lo calcula `ProveedorEnVivo` al recibir
  // `en-vivo:cambio`): un solo sonido por tanda.
  const { lote } = usePedidosNuevos();
  const loteSonado = useRef(lote);
  useEffect(() => {
    if (lote === loteSonado.current) return;
    loteSonado.current = lote;
    sonar('pedido-en-vivo');
  }, [lote, sonar]);

  return null;
}
