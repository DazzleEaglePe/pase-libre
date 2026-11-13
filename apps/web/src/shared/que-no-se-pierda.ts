/**
 * Que no se pierda nada (doc 19, punto 22): las reglas de cuándo suena y qué dice la pestaña.
 * Funciones puras, para probarlas sin navegador; el componente que las usa está en
 * `shared/ui/que-no-se-pierda.tsx`.
 */

/** Como mucho un sonido cada 3 s, aunque lleguen varios mensajes o pedidos seguidos. */
export const ESPERA_ENTRE_SONIDOS_MS = 3_000;
/** Cada cuánto se alterna el título de la pestaña escondida. */
export const CAMBIO_DE_TITULO_MS = 1_500;

/** M3 («marimba de dos notas») para los mensajes y V6 («tres notas de marimba») para En vivo. */
export type Sonido = 'mensaje' | 'pedido-en-vivo';

/** «22:00» a «08:00», hora de Lima, como lo guarda Configuración › Avisos. */
export interface HorarioSilencioso {
  desde: string;
  hasta: string;
}

/** Lima no cambia de hora en el año: siempre UTC−5. */
const DESFASE_LIMA_MIN = -5 * 60;
const MINUTOS_DIA = 24 * 60;

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Si ahora es «No molestar» (como `visibleDesde` de la API): el horario puede cruzar la
 * medianoche (22:00 a 08:00). Sin horario, nunca.
 */
export function enNoMolestar(horario: HorarioSilencioso | null, ahora: Date): boolean {
  if (!horario) return false;
  const desde = aMinutos(horario.desde);
  const hasta = aMinutos(horario.hasta);
  if (desde === hasta) return false;
  const minutoUtc = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  const minuto = (minutoUtc + DESFASE_LIMA_MIN + MINUTOS_DIA) % MINUTOS_DIA;
  return desde < hasta ? minuto >= desde && minuto < hasta : minuto >= desde || minuto < hasta;
}

/**
 * El chat está abierto y a la vista: la ruta es `/mensajes/{id}` de esa conversación y la pestaña
 * se ve. Ahí el mensaje ya se lee, así que no suena ni salta nada.
 */
export function chatALaVista(ruta: string, visible: boolean, conversacionId: string): boolean {
  return visible && ruta.replace(/\/+$/, '') === `/mensajes/${conversacionId}`;
}

export interface EstadoDelSonido {
  /** Configuración › Avisos › «Sonido». */
  activo: boolean;
  noMolestar: HorarioSilencioso | null;
  /** El navegador ya dejó sonar: hubo un clic o una tecla en la página. */
  desbloqueado: boolean;
  /** Cuándo sonó el último (ms), en esta pestaña o en otra. 0 si nunca. */
  ultimo: number;
}

/** Si puede sonar ahora: prendido, fuera de «No molestar», desbloqueado y sin otro hace < 3 s. */
export function puedeSonar(estado: EstadoDelSonido, ahora: number): boolean {
  if (!estado.activo || !estado.desbloqueado) return false;
  if (enNoMolestar(estado.noMolestar, new Date(ahora))) return false;
  return ahora - estado.ultimo >= ESPERA_ENTRE_SONIDOS_MS;
}

/**
 * El título de la pestaña escondida, que se alterna cada 1,5 s: en los pasos pares
 * «(N) Mensajes · PaseLibre» y en los impares «💬 {tienda} te escribió».
 */
export function tituloDeLaPestana(paso: number, sinLeer: number, remitente: string | null): string {
  if (paso % 2 === 0) return `(${Math.max(1, sinLeer)}) Mensajes · PaseLibre`;
  return remitente ? `💬 ${remitente} te escribió` : '💬 Tienes un mensaje nuevo';
}
