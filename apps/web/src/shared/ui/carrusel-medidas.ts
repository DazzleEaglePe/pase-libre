/** Lo que se lee de la fila que se desliza, en píxeles. */
export interface MedidasFila {
  /** Ancho de todo el contenido, lo que se ve y lo que no. */
  anchoTotal: number;
  /** Ancho de lo que se ve, con el relleno de la fila. */
  anchoVisible: number;
  /** Cuánto se ha desplazado desde el inicio. */
  desplazado: number;
  /** Espacio entre tarjetas. */
  hueco: number;
  /** Relleno de la fila a los dos lados (deja lugar al contorno del foco). */
  relleno: number;
}

export interface PosicionFila {
  /** Cuántas páginas tiene la fila; 1 si todo cabe y no hay nada que deslizar. */
  paginas: number;
  /** En cuál está, de 0 a `paginas - 1`. */
  pagina: number;
  alInicio: boolean;
  alFinal: boolean;
  /** Cuánto se desplaza la fila al pasar de una página a otra. */
  paso: number;
  /** Lo máximo que puede desplazarse. */
  maximo: number;
  /** La parte de la fila que se ve (0 a 1) y cuánto lleva recorrido (0 a 1), para la barra. */
  visible: number;
  avance: number;
}

/**
 * Una página es lo que cabe en la fila de una vez. La última no siempre es completa: llega
 * hasta donde acaba el contenido. Con una tolerancia de 1 px por los decimales del navegador.
 */
export function posicionDeLaFila(medidas: MedidasFila): PosicionFila {
  const { anchoTotal, anchoVisible, desplazado, hueco, relleno } = medidas;
  const maximo = Math.max(0, anchoTotal - anchoVisible);
  const paso = Math.max(1, anchoVisible - relleno + hueco);
  const paginas = maximo > 1 ? Math.ceil((maximo - 1) / paso) + 1 : 1;
  const alInicio = desplazado <= 1;
  const alFinal = desplazado >= maximo - 1;
  const pagina = alFinal ? paginas - 1 : Math.min(paginas - 1, Math.round(desplazado / paso));
  return {
    paginas,
    pagina: Math.max(0, pagina),
    alInicio,
    alFinal,
    paso,
    maximo,
    visible: anchoVisible / Math.max(anchoTotal, 1),
    avance: maximo > 0 ? Math.min(1, Math.max(0, desplazado / maximo)) : 0,
  };
}
