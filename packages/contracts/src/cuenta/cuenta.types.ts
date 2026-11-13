import type { Moneda } from '../comun/dinero.js';
import type { AjusteLogo } from './cuenta.schemas.js';
import type { Rol, TipoTienda } from '../sesion/sesion.types.js';
import type { TramoHorario } from '../tiendas/horario.js';

/** Galería, piso y stand de una tienda. */
export interface LugarTienda {
  galeria_id: string | null;
  /** El nombre de la galería: «Cyberplaza». */
  galeria: string | null;
  piso: string | null;
  stand: string | null;
}

/**
 * Un cambio de galería, piso o stand que espera al Equipo (N09: «Pendiente de aprobación»).
 * Hasta que lo confirman, el perfil sigue mostrando el lugar de antes.
 */
export interface LugarPendiente extends LugarTienda {
  pedido_en: string;
}

/** `GET /v1/cuenta` y `PATCH /v1/cuenta`: Configuración · Datos, Privacidad y Preferencias. */
export interface RespuestaCuenta {
  usuario: {
    usuario: string;
    nombre: string;
    correo: string | null;
    /** El de la persona; nulo si usa el de la tienda. */
    whatsapp: string | null;
    rol: Rol;
    mostrar_visto: boolean;
  };
  tienda: {
    nombre: string;
    tipo: TipoTienda;
    galeria: string | null;
    stand: string | null;
    galeria_id: string | null;
    piso: string | null;
    /** El cambio de lugar que espera al Equipo, o nulo. */
    lugar_pendiente: LugarPendiente | null;
    whatsapp: string;
    horario: string | null;
    /** El horario por días (o leído del `horario` escrito a mano); nulo si no se entiende. */
    horario_tramos: TramoHorario[] | null;
    /** Ruta de la portada subida, para «Perfil al N %». */
    portada: string | null;
    /** «Cómo llegar»: cómo se sube hasta el stand. */
    indicaciones: string | null;
    descripcion: string | null;
    /** Ruta del logo (`/media/<ruta>`), o nulo. */
    logo: string | null;
    /**
     * «Ajustar logo» (docs/19 §20): la foto original y cómo se acomodó, para volver a abrirla. Con
     * un logo de antes (o subido sin ajustar), la original es el mismo logo y el ajuste es nulo.
     */
    logo_original: string | null;
    logo_ajuste: AjusteLogo | null;
    precio_visible_defecto: boolean;
    moneda_defecto: Moneda;
  } | null;
}

/** `GET/PUT /v1/cuenta/avisos` (RF-59). Las horas van como «22:00», hora de Lima. */
export interface RespuestaAvisosCuenta {
  /** Los de En vivo llegan solo cuando En vivo está encendido (D-53). */
  campanita: {
    MENSAJE: boolean;
    EN_VIVO?: boolean;
    EN_VIVO_RESPUESTA?: boolean;
    VENTA: boolean;
    RECORDATORIO: boolean;
    SEGUIDA: boolean;
    ALERTA: boolean;
    EQUIPO: boolean;
  };
  no_molestar: { desde: string; hasta: string } | null;
}

/** Una sesión abierta, para «Cerrar todas las demás» (Configuración · Seguridad). */
export interface SesionAbierta {
  id: string;
  /** «Chrome en Android», a partir del navegador. */
  dispositivo: string;
  /** «Lima». */
  lugar: string;
  ultimo_uso: string;
  actual: boolean;
}

/** `GET /v1/cuenta/sesiones` (N10): «Sesiones abiertas · 2 de 2». */
export interface RespuestaSesiones {
  sesiones: SesionAbierta[];
  /** Solo la cuenta principal tiene límite; nulo para el asesor. */
  limite: number | null;
}

/** Una tienda bloqueada, para desbloquearla desde Configuración · Privacidad. */
export interface TiendaBloqueada {
  tienda: { id: string; nombre: string; galeria: string | null };
  desde: string;
}

/** Una alerta de búsqueda: te avisamos cuando alguien publica algo con estas palabras. */
export interface AlertaBusqueda {
  id: string;
  texto: string;
  creada_en: string;
}

/**
 * `GET /v1/cuenta/resumen` (D_Cuenta, P_WebCuentaD2, sección 14 del lienzo final): lo que se
 * cuenta de tu tienda en «Tu cuenta» y en tu perfil.
 */
export interface ResumenCuenta {
  /** «Miembro desde octubre de 2026». */
  miembro_desde: string;
  /** La cuenta salió del registro propio (si no, la creó el equipo). */
  por_registro: boolean;
  /** «48 pases cerrados en 60 días». */
  ventas_60: number;
  /** «~10 min para responder»: nulo con menos de 3 chats contestados. */
  responde_en: number | null;
  /** «98 % chats respondidos» en 60 días: nulo sin chats. */
  respondidos: number | null;
  estrellas: number | null;
  opiniones: number;
  /** «Vende gráficas, RAM y procesadores»: sus 3 categorías con más publicaciones. */
  vende: string[];
  /** Hilos con mensajes en los últimos 30 días: «3 chats abiertos». */
  chats_abiertos: number;
  /** El WhatsApp de la tienda, con lo del medio tapado: «+51 9•• ••• 482». */
  whatsapp: string | null;
  /** «Tu mes» (N04): ventas marcadas este mes, en hora de Lima. */
  ventas_mes: number;
  /** «1 chat sin responder»: chats de los últimos 30 días cuyo último mensaje es de la otra tienda. */
  sin_responder: number;
}

/** Una galería para elegir en Configuración · Datos de la tienda. */
export interface GaleriaParaElegir {
  id: string;
  nombre: string;
}

/** `GET /v1/equipo/cambios-de-lugar`: lo que el Equipo tiene que confirmar. */
export interface CambioDeLugar {
  id: string;
  tienda: { id: string; nombre: string };
  antes: LugarTienda;
  despues: LugarTienda;
  /** Quién lo pidió: «Luis P.». */
  pedido_por: string;
  pedido_en: string;
}

/** `PUT /v1/cuenta/logo` (docs/19 §20): el logo de 512 × 512 que se armó y cómo se hizo. */
export interface RespuestaLogo {
  logo: string;
  original: string;
  ajuste: AjusteLogo;
}
