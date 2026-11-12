import type { PapelRespuesta, RespuestaRapida } from '@paselibre/contracts';
import type { PapelRespuesta as PapelEnBase } from '@prisma/client';

/**
 * Respuestas rápidas con las que arranca toda cuenta nueva (RF-56, N11): cuatro de cada papel.
 * `{tienda}` es la ficha «Nombre de la tienda». Se editan en Configuración › Preferencias.
 */
export const RESPUESTAS_RAPIDAS_INICIALES: ReadonlyArray<{
  texto: string;
  papel: PapelEnBase;
  orden: number;
}> = [
  { texto: 'Hola, {tienda}, ¿qué tal? 👋', papel: 'VENDEDOR', orden: 0 },
  { texto: 'Déjame revisar el stock y en breve te confirmo.', papel: 'VENDEDOR', orden: 1 },
  { texto: 'Te lo separo', papel: 'VENDEDOR', orden: 2 },
  { texto: 'Ahora no lo tengo, pero te aviso si me llega.', papel: 'VENDEDOR', orden: 3 },
  { texto: '¿Sigue disponible?', papel: 'COMPRADOR', orden: 0 },
  { texto: '¿Me lo separas?', papel: 'COMPRADOR', orden: 1 },
  { texto: 'Paso a recoger', papel: 'COMPRADOR', orden: 2 },
  { texto: '¿Cuál es tu mejor precio?', papel: 'COMPRADOR', orden: 3 },
];

export const papelEnBase = (papel: PapelRespuesta): PapelEnBase =>
  papel === 'vendedor' ? 'VENDEDOR' : 'COMPRADOR';

export const respuestaRapida = (fila: {
  id: string;
  texto: string;
  papel: PapelEnBase;
}): RespuestaRapida => ({
  id: fila.id,
  texto: fila.texto,
  papel: fila.papel === 'VENDEDOR' ? 'vendedor' : 'comprador',
});
