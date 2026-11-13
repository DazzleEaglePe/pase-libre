import type { IncomingMessage } from 'node:http';

import { type INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/**
 * Los orígenes desde los que se acepta la web: el de `WEB_URL`, su par con o sin `www.` y los
 * de `ORIGENES_EXTRA`. Google lleva a `www.paselibre.shop`; si un día se cae la regla de
 * Cloudflare que lo pasa a la raíz, el socket tiene que seguir entrando (doc 19, A1).
 */
export function origenesPermitidos(webUrl: string, extra: readonly string[] = []): string[] {
  const base = new URL(webUrl);
  const par = new URL(webUrl);
  const esIp = /^[\d.]+$/.test(base.hostname) || base.hostname.includes(':');
  const lista = [base.origin];
  if (!esIp && base.hostname !== 'localhost') {
    par.hostname = base.hostname.startsWith('www.')
      ? base.hostname.slice(4)
      : `www.${base.hostname}`;
    lista.push(par.origin);
  }
  for (const otro of extra) {
    try {
      lista.push(new URL(otro).origin);
    } catch {
      // Un valor mal escrito no tumba la API: se ignora.
    }
  }
  return [...new Set(lista)];
}

/**
 * El adaptador de socket.io con lo que no se puede poner en el decorador: el origen de la
 * web sale de la configuración.
 *
 * CORS no protege a un WebSocket: el navegador manda la cookie desde cualquier sitio. Por
 * eso se revisa el origen en el handshake (defensa contra el secuestro de sockets entre
 * sitios). Sin cabecera Origin solo llegan clientes que no son navegadores, que igual
 * necesitan una cookie de sesión válida.
 */
export class AdaptadorTiempoReal extends IoAdapter {
  private readonly logger = new Logger('TiempoReal');

  constructor(
    app: INestApplicationContext,
    private readonly origenes: readonly string[],
  ) {
    super(app);
  }

  override createIOServer(puerto: number, opciones?: ServerOptions): unknown {
    const permitidos = new Set(this.origenes);
    return super.createIOServer(puerto, {
      ...opciones,
      cors: { origin: [...permitidos], credentials: true },
      allowRequest: (
        solicitud: IncomingMessage,
        responder: (error: string | null | undefined, permitido: boolean) => void,
      ) => {
        const desde = solicitud.headers.origin;
        const permitido = !desde || permitidos.has(desde);
        if (!permitido) {
          // Que quede en los registros: así no hay que adivinar si vuelve a pasar.
          this.logger.warn(
            `Socket rechazado por origen: ${desde} (ip ${solicitud.socket.remoteAddress ?? '?'})`,
          );
        }
        responder(null, permitido);
      },
    });
  }
}
