import type { IncomingMessage } from 'node:http';

import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

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
  constructor(
    app: INestApplicationContext,
    private readonly webUrl: string,
  ) {
    super(app);
  }

  override createIOServer(puerto: number, opciones?: ServerOptions): unknown {
    const origen = new URL(this.webUrl).origin;
    return super.createIOServer(puerto, {
      ...opciones,
      cors: { origin: origen, credentials: true },
      allowRequest: (
        solicitud: IncomingMessage,
        responder: (error: string | null | undefined, permitido: boolean) => void,
      ) => {
        const desde = solicitud.headers.origin;
        responder(null, !desde || desde === origen);
      },
    });
  }
}
