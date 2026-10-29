/** El proceso de la web responde. No toca la API: es el healthcheck de la imagen. */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ estado: 'ok', servicio: 'paselibre-web' });
}
