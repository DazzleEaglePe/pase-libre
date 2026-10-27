/**
 * Enlace al WhatsApp del equipo de PaseLibre, con el mensaje ya escrito.
 * Nulo mientras no exista el número (docs/04, pendiente 6): la interfaz esconde el botón.
 */
export function enlaceWhatsappEquipo(mensaje: string): string | null {
  const numero = process.env.NEXT_PUBLIC_WHATSAPP_EQUIPO?.replace(/\D/g, '');
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
