import type { MensajeChat } from '@paselibre/contracts';

import { haceCuanto } from '@/shared/fechas';

/** Los checks como WhatsApp (N01): enviado (uno gris), le llegó (dos grises), lo leyó (verdes). */
export type EstadoCheck = 'enviado' | 'recibido' | 'leido';

export function estadoDeCheck(
  m: Pick<MensajeChat, 'creado_en'>,
  recibidoHasta: string | null,
  vistoHasta: string | null,
): EstadoCheck {
  if (vistoHasta && vistoHasta >= m.creado_en) return 'leido';
  if (recibidoHasta && recibidoHasta >= m.creado_en) return 'recibido';
  return 'enviado';
}

/**
 * «Activo ahora», o «Activo hace 2 min», «hace 3 h», «ayer»… (N01). Se vuelve a calcular cada
 * medio minuto, así pasa solo de uno a otro sin recargar.
 */
export function textoActivo(
  enLinea: boolean,
  ultimaConexion: string | null,
  ahora = new Date(),
): string {
  if (enLinea) return 'Activo ahora';
  if (!ultimaConexion) return '';
  const minutos = Math.round((ahora.getTime() - Date.parse(ultimaConexion)) / 60_000);
  if (minutos < 60) return `Activo hace ${Math.max(1, minutos)} min`;
  if (minutos < 24 * 60) return `Activo hace ${Math.round(minutos / 60)} h`;
  return `Activo ${haceCuanto(ultimaConexion, ahora).toLowerCase()}`;
}

/** «quedan 11 min» al editar (N01); 0 si ya no se puede. */
export function minutosQueQuedan(cambiableHasta: string | null, ahora = new Date()): number {
  if (!cambiableHasta) return 0;
  return Math.max(0, Math.ceil((Date.parse(cambiableHasta) - ahora.getTime()) / 60_000));
}

/** «987654321» → «+51 987 654 321». */
export function numeroConPrefijo(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  return `+51 ${digitos.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')}`;
}

export function enlaceWhatsapp(numero: string): string {
  return `https://wa.me/51${numero.replace(/\D/g, '')}`;
}

/** El texto del último mensaje en la lista de chats. */
export function extractoDeMensaje(m: MensajeChat): string {
  if (m.eliminado) return m.mio ? 'Eliminaste este mensaje' : 'Se eliminó este mensaje';
  if (m.tipo === 'PEDIDO_WHATSAPP') {
    return m.mio ? 'Le pediste su WhatsApp' : 'Te pidió tu WhatsApp';
  }
  if (m.tipo === 'WHATSAPP') {
    return m.mio ? 'Compartiste tu WhatsApp' : 'Te compartió su WhatsApp';
  }
  const texto = m.tipo === 'FOTO' ? (m.texto ? `Foto · ${m.texto}` : 'Foto') : (m.texto ?? '');
  return m.mio ? `Tú: ${texto}` : texto;
}
