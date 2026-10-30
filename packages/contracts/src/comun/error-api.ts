/** Códigos que la interfaz puede usar para decidir qué mostrar. El mensaje ya viene en español. */
export const CODIGOS_ERROR = [
  'DATOS_INVALIDOS',
  'SIN_SESION',
  'PROHIBIDO',
  'NO_ENCONTRADO',
  'CONFLICTO',
  'DEMASIADAS_SOLICITUDES',
  'CREDENCIALES_INVALIDAS',
  'CUENTA_SUSPENDIDA',
  'CUENTA_BLOQUEADA_TEMPORALMENTE',
  'DEBE_CAMBIAR_CLAVE',
  'CLAVE_ACTUAL_INCORRECTA',
  /** La otra persona bloqueó a tu tienda: no puedes escribirle ni contactarla (RF-57). */
  'BLOQUEADO',
  /** Ya tienes 3 publicaciones en vivo a la vez (RF-73). */
  'LIMITE_EN_VIVO',
  /** Tu tienda ya respondió a este busco o a esta oferta flash (RF-26). */
  'YA_RESPONDISTE',
  'FALTA_CABECERA_PASELIBRE',
  'SERVICIO_NO_DISPONIBLE',
  'ERROR_INTERNO',
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

export interface RespuestaError {
  error: {
    codigo: CodigoError;
    mensaje: string;
    detalles?: Record<string, unknown>;
    id_solicitud: string;
  };
}

/**
 * Las peticiones que cambian datos desde el navegador llevan esta cabecera.
 * Un formulario de otro sitio no puede ponerla, así que sirve de defensa contra CSRF
 * junto con la cookie `SameSite=Lax` (docs/05 §9).
 */
export const CABECERA_PASELIBRE = 'x-paselibre';
