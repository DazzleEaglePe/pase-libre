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

interface TiempoReal {
  socket: Socket | null;
  /** Sube cada vez que el socket queda listo; al cambiar, hay que volver a pedir los datos. */
  conexion: number;
}

const Contexto = createContext<TiempoReal>({ socket: null, conexion: 0 });

/**
 * Un solo socket por pestaña para el chat y la campanita (docs/05 §6.3). Si se cae, vuelve
 * a conectarse solo y avisa con `conexion` para que cada pantalla pida lo que se perdió.
 * Si la sesión ya no sirve, refresca la página y el layout manda a /ingresar.
 */
export function ProveedorTiempoReal({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<TiempoReal>({ socket: null, conexion: 0 });

  useEffect(() => {
    const socket = io(DIRECCION ?? '', {
      path: RUTA_TIEMPO_REAL,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socket.on(EVENTOS.listo, () =>
      setEstado((anterior) => ({ socket, conexion: anterior.conexion + 1 })),
    );
    socket.on(EVENTOS.sinSesion, () => router.refresh());
    // Cortado por el servidor (salir, suspensión): no reconecta solo.
    socket.on('disconnect', (motivo) => {
      if (motivo === 'io server disconnect') router.refresh();
    });
    setEstado((anterior) => ({ ...anterior, socket }));
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [router]);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

/** El número de conexión: cambia al conectar y al reconectar. */
export function useConexionTiempoReal(): number {
  return useContext(Contexto).conexion;
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
