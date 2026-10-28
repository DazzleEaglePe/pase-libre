import {
  CABECERA_PASELIBRE,
  type ArchivoSubido,
  type CodigoError,
  type RespuestaError,
} from '@paselibre/contracts';

/** Error de la API con el código y el mensaje en español listo para mostrar. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: CodigoError | 'SIN_CONEXION',
    mensaje: string,
    readonly detalles?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
}

/**
 * Llamadas desde el navegador. Van al mismo origen (`/v1`, ver next.config) con la
 * cookie de sesión y la cabecera `X-PaseLibre` que exige la API en los cambios.
 */
export async function llamarApi<T>(
  ruta: string,
  opciones: {
    metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    cuerpo?: unknown;
    /** Para subir archivos: el navegador pone el `Content-Type` con su separador. */
    formulario?: FormData;
  } = {},
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/v1${ruta}`, {
      method: opciones.metodo ?? 'GET',
      credentials: 'same-origin',
      headers: {
        [CABECERA_PASELIBRE]: '1',
        ...(opciones.cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body:
        opciones.formulario ??
        (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)),
    });
  } catch {
    throw new ErrorApi(
      0,
      'SIN_CONEXION',
      'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
    );
  }

  if (respuesta.status === 204) return undefined as T;
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = (datos as RespuestaError | null)?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo ?? 'ERROR_INTERNO',
      error?.mensaje ?? 'Algo falló de nuestro lado. Vuelve a intentarlo.',
      error?.detalles,
    );
  }
  return datos as T;
}

/** Sube una foto (`POST /v1/archivos`). La API la revisa, le quita el EXIF y la pasa a WebP. */
export function subirFoto(archivo: File): Promise<ArchivoSubido> {
  const formulario = new FormData();
  formulario.append('foto', archivo);
  return llamarApi<ArchivoSubido>('/archivos', { metodo: 'POST', formulario });
}
