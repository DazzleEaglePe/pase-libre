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
    readonly codigo: CodigoError | 'SIN_CONEXION' | 'CANCELADA',
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

/**
 * Sube un archivo con `XMLHttpRequest` para saber cuánto va (docs/18 §7): `fetch` no avisa del
 * avance de lo que se manda. Mismas cabeceras y cookie que `llamarApi`. `cancelar` corta la
 * subida y la promesa termina con un `ErrorApi` de código `CANCELADA`.
 */
export function subirConAvance<T>(
  ruta: string,
  formulario: FormData,
  avisos: {
    /** Lo que ya se subió, en bytes. */
    alAvanzar?: (cargado: number, total: number) => void;
    /** Ya se subió todo: ahora la API lo revisa. */
    alTerminarSubida?: () => void;
  } = {},
): { promesa: Promise<T>; cancelar: () => void } {
  const xhr = new XMLHttpRequest();
  const promesa = new Promise<T>((resolver, rechazar) => {
    xhr.open('POST', `/v1${ruta}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader(CABECERA_PASELIBRE, '1');
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) avisos.alAvanzar?.(evento.loaded, evento.total);
    };
    xhr.upload.onload = () => avisos.alTerminarSubida?.();
    xhr.onerror = () =>
      rechazar(
        new ErrorApi(
          0,
          'SIN_CONEXION',
          'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
        ),
      );
    xhr.onabort = () => rechazar(new ErrorApi(0, 'CANCELADA', 'Cancelaste la subida.'));
    xhr.onload = () => {
      let datos: unknown = null;
      try {
        datos = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        datos = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolver(datos as T);
        return;
      }
      const error = (datos as RespuestaError | null)?.error;
      rechazar(
        new ErrorApi(
          xhr.status,
          error?.codigo ?? 'ERROR_INTERNO',
          // nginx corta lo que pasa de 40 MB sin el formato de la API.
          xhr.status === 413
            ? 'El archivo pesa más de 40 MB. Pártelo en dos.'
            : (error?.mensaje ?? 'Algo falló de nuestro lado. Vuelve a intentarlo.'),
          error?.detalles,
        ),
      );
    };
    xhr.send(formulario);
  });
  return { promesa, cancelar: () => xhr.abort() };
}

/**
 * Sube una foto (`POST /v1/archivos`). La API la revisa, le quita el EXIF y la pasa a WebP. Con
 * `para: 'portada'` se guarda de hasta 2400 px (docs/19 §20); las demás, de 1600.
 */
export function subirFoto(archivo: File, para?: 'portada'): Promise<ArchivoSubido> {
  const formulario = new FormData();
  formulario.append('foto', archivo);
  return llamarApi<ArchivoSubido>(para ? `/archivos?para=${para}` : '/archivos', {
    metodo: 'POST',
    formulario,
  });
}
