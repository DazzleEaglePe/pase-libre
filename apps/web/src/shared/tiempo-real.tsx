'use client';

import { EVENTOS, RUTA_TIEMPO_REAL } from '@paselibre/contracts';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

/**
 * Dónde está el socket. En producción, el mismo dominio (nginx lleva `/tiempo-real` a la
 * API); en local, la API directa, porque el rewrite de Next no pasa WebSockets. La cookie
 * viaja igual: `localhost:3000` y `localhost:3001` son el mismo sitio.
 */
const DIRECCION =
  process.env.NEXT_PUBLIC_TIEMPO_REAL_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : undefined);

/** Sin conexión, cada pantalla vuelve a pedir lo suyo cada 25 s (doc 19, A2). */
export const RESPALDO_MS = 25_000;
/** La franja «Reconectando…» sale recién después de 5 s: cambiar de wifi no la muestra. */
export const AVISO_DESCONEXION_MS = 5_000;

interface TiempoReal {
  socket: Socket | null;
  /** Sube cada vez que el socket queda listo; al cambiar, hay que volver a pedir los datos. */
  conexion: number;
  /** `null` fuera del proveedor (el visitante no abre socket); si no, si está conectado. */
  conectado: boolean | null;
}

const Contexto = createContext<TiempoReal>({ socket: null, conexion: 0, conectado: null });

/**
 * Un solo socket por pestaña para el chat y la campanita (docs/05 §6.3). Si se cae, vuelve
 * a conectarse solo y avisa con `conexion` para que cada pantalla pida lo que se perdió.
 * Si la sesión ya no sirve, refresca la página y el layout manda a /ingresar.
 *
 * Nunca falla en silencio (doc 19, A2): prueba WebSocket y, si no pasa, polling; mientras no
 * hay conexión, `useRespaldo` vuelve a pedir los datos cada 25 s; y a los 5 s sin conexión
 * avisa arriba «Reconectando…».
 */
export function ProveedorTiempoReal({
  children,
  apagado = false,
}: {
  children: ReactNode;
  /** En «Ayudar como la tienda» no hay tiempo real: el equipo no recibe los chats (N14). */
  apagado?: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<TiempoReal>({
    socket: null,
    conexion: 0,
    conectado: apagado ? null : false,
  });
  // Cortado por el servidor: se crea otro socket con espera creciente (5 s, 10 s… hasta 60 s).
  const [intento, setIntento] = useState(0);
  const espera = useRef(5_000);

  useEffect(() => {
    if (apagado) {
      setEstado({ socket: null, conexion: 0, conectado: null });
      return;
    }
    const socket = io(DIRECCION ?? '', {
      path: RUTA_TIEMPO_REAL,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // Si el WebSocket no pasa (antivirus, red del local, VPN), prueba el polling.
      tryAllTransports: true,
    });
    let reintento: ReturnType<typeof setTimeout> | undefined;
    socket.on(EVENTOS.listo, () => {
      espera.current = 5_000;
      setEstado((anterior) => ({ socket, conexion: anterior.conexion + 1, conectado: true }));
    });
    socket.on(EVENTOS.sinSesion, () => router.refresh());
    socket.on('connect_error', () => setEstado((anterior) => ({ ...anterior, conectado: false })));
    socket.on('disconnect', (motivo) => {
      setEstado((anterior) => ({ ...anterior, conectado: false }));
      // Cortado por el servidor (salir, suspensión, sesión vencida): no reconecta solo. Se
      // refresca (si la sesión ya no sirve, el layout manda a /ingresar) y, si la página sigue
      // aquí, se vuelve a intentar con un socket nuevo.
      if (motivo === 'io server disconnect') {
        router.refresh();
        reintento = setTimeout(() => setIntento((n) => n + 1), espera.current);
        espera.current = Math.min(espera.current * 2, 60_000);
      }
    });
    setEstado((anterior) => ({ ...anterior, socket, conectado: false }));
    return () => {
      clearTimeout(reintento);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [router, apagado, intento]);

  return (
    <Contexto.Provider value={estado}>
      <FranjaReconectando conectado={estado.conectado} />
      {children}
    </Contexto.Provider>
  );
}

/** «Reconectando… los mensajes pueden tardar»: gris oscuro, arriba, solo tras 5 s sin conexión. */
function FranjaReconectando({ conectado }: { conectado: boolean | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (conectado !== false) {
      setVisible(false);
      return;
    }
    const reloj = setTimeout(() => setVisible(true), AVISO_DESCONEXION_MS);
    return () => clearTimeout(reloj);
  }, [conectado]);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex justify-center bg-[#2e3833] px-4 py-1.5 text-center text-[13px] font-semibold text-white"
    >
      Reconectando… los mensajes pueden tardar
    </div>
  );
}

/** El número de conexión: cambia al conectar y al reconectar. */
export function useConexionTiempoReal(): number {
  return useContext(Contexto).conexion;
}

/** Si el socket está conectado; `null` fuera del proveedor (sin sesión de tienda). */
export function useConectado(): boolean | null {
  return useContext(Contexto).conectado;
}

/**
 * El respaldo cuando el tiempo real no está (doc 19, A2): mientras el socket no esté
 * conectado, llama a `cargar` cada 25 s con la pestaña a la vista. También al volver a la
 * pestaña, conectado o no: si el navegador la durmió, pudo perderse algo.
 */
export function useRespaldo(cargar: () => unknown, cada = RESPALDO_MS): void {
  const conectado = useConectado();
  const ultimo = useRef(cargar);
  ultimo.current = cargar;

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') void ultimo.current();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  useEffect(() => {
    if (conectado !== false) return;
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') void ultimo.current();
    }, cada);
    return () => clearInterval(reloj);
  }, [conectado, cada]);
}

/** Escucha un evento mientras el componente está montado; siempre con el manejador más reciente. */
export function useEvento<T>(evento: string, manejador: (datos: T) => void): void {
  const { socket } = useContext(Contexto);
  const ultimo = useRef(manejador);
  ultimo.current = manejador;

  useEffect(() => {
    if (!socket) return;
    const escuchar = (datos: T) => ultimo.current(datos);
    socket.on(evento, escuchar);
    return () => {
      socket.off(evento, escuchar);
    };
  }, [socket, evento]);
}
