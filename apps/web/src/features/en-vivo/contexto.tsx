'use client';

import type { RespuestaEnVivo } from '@paselibre/contracts';
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useEnVivo } from './datos';
import { DURA_NUEVO_MS, ENTRE_ENTRADAS_MS, pedidosQueEntran } from './nuevos';

/**
 * Los pedidos que acaban de entrar (doc 19, punto 22). `entrados` guarda todos los de esta
 * página, el último primero (van adelante en la banda y en la tarjeta mini); `marcados` solo los
 * de los últimos 10 s, con cuánto espera cada uno para entrar si llegaron varios juntos. `lote`
 * sube cada vez que entra alguno: con eso suena una sola vez.
 */
export interface PedidosQueEntran {
  entrados: readonly string[];
  marcados: ReadonlyMap<string, { espera: number }>;
  lote: number;
}

interface EnVivoCompartido {
  datos: RespuestaEnVivo | null;
  activo: boolean;
  nuevos: PedidosQueEntran;
}

const SIN_NUEVOS: PedidosQueEntran = { entrados: [], marcados: new Map(), lote: 0 };

const Contexto = createContext<EnVivoCompartido | null>(null);

/**
 * Una sola lista de En vivo por página para la ventana flotante y la entrada de la banda de
 * categorías: así no se pide dos veces. Va dentro del tiempo real, si hay sesión. También sabe
 * qué pedidos acaban de entrar, para que la banda y la tarjeta mini los hagan brillar.
 */
export function ProveedorEnVivo({ children }: { children: ReactNode }) {
  const { datos, activo } = useEnVivo();
  const nuevos = useSeguirLosNuevos(datos);
  return <Contexto.Provider value={{ datos, activo, nuevos }}>{children}</Contexto.Provider>;
}

/**
 * Compara cada lista con la anterior. La primera no cuenta (es lo que ya había al entrar). Se
 * calcula antes de pintar, así la tarjeta nueva no se ve un instante entera antes de entrar.
 */
function useSeguirLosNuevos(datos: RespuestaEnVivo | null): PedidosQueEntran {
  const conocidos = useRef<Set<string> | null>(null);
  const [nuevos, setNuevos] = useState<PedidosQueEntran>(SIN_NUEVOS);
  const relojes = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useLayoutEffect(() => {
    const lista = datos?.en_vivo;
    if (!lista) return;
    if (conocidos.current === null) {
      conocidos.current = new Set(lista.map((item) => item.id));
      return;
    }
    const ids = pedidosQueEntran(conocidos.current, lista, Date.now());
    for (const item of lista) conocidos.current.add(item.id);
    if (ids.length === 0) return;
    setNuevos((actual) => {
      const marcados = new Map(actual.marcados);
      // El más nuevo entra primero y los demás detrás, uno tras otro.
      ids.forEach((id, i) => marcados.set(id, { espera: i * ENTRE_ENTRADAS_MS }));
      return {
        entrados: [...ids, ...actual.entrados.filter((id) => !ids.includes(id))],
        marcados,
        lote: actual.lote + 1,
      };
    });
    // «NUEVO» se va solo a los 10 s (contados desde que entra cada uno).
    ids.forEach((id, i) => {
      relojes.current.push(
        setTimeout(
          () =>
            setNuevos((actual) => {
              if (!actual.marcados.has(id)) return actual;
              const marcados = new Map(actual.marcados);
              marcados.delete(id);
              return { ...actual, marcados };
            }),
          DURA_NUEVO_MS + i * ENTRE_ENTRADAS_MS,
        ),
      );
    });
  }, [datos]);

  useEffect(
    () => () => {
      for (const reloj of relojes.current) clearTimeout(reloj);
    },
    [],
  );

  return nuevos;
}

/** Nulo fuera del proveedor (el panel del equipo, por ejemplo). */
export function useEnVivoCompartido(): EnVivoCompartido | null {
  return useContext(Contexto);
}

/** Los pedidos que acaban de entrar; sin proveedor, ninguno. */
export function usePedidosNuevos(): PedidosQueEntran {
  return useContext(Contexto)?.nuevos ?? SIN_NUEVOS;
}

/**
 * Como `useEnVivoCompartido`, pero nulo hasta que el componente se montó. El HTML del
 * servidor nunca trae Pedidos en vivo: si la lista llega antes de que una parte que se hidrata
 * tarde (dentro de un Suspense, como la banda de categorías) termine de hidratarse, React
 * vería un enlace que el servidor no dibujó y rehace esa parte entera.
 */
export function useEnVivoMontado(): EnVivoCompartido | null {
  const compartido = useContext(Contexto);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? compartido : null;
}
