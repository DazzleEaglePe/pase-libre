/** El interruptor del registro propio (`REGISTRO_PROPIO`). Las pruebas lo fijan sin tocar el entorno. */
export const INTERRUPTOR_REGISTRO = Symbol('INTERRUPTOR_REGISTRO');

export interface InterruptorRegistro {
  activo: boolean;
}
