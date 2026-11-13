/**
 * La versión de PaseLibre y lo que trae cada una (docs/18 §9). Es la única fuente: el pie de las
 * tiendas, el panel del Equipo y `/equipo/versiones` leen de aquí.
 *
 * Cómo sube el número en cada tanda:
 * - el primero (2.0.0), si cambia cómo se usa PaseLibre (otras galerías, app, pagos, rediseño);
 * - el segundo (1.9.0), si trae cosas nuevas que la tienda nota;
 * - el tercero (1.9.1), si solo son arreglos o retoques.
 */

export interface DetalleParaElEquipo {
  nuevo: string[];
  cambia: string[];
  arregla: string[];
  datos: string[];
}

export interface Novedad {
  version: string;
  /** Día en que salió, `AAAA-MM-DD`. */
  fecha: string;
  /** Lo que ven las tiendas: frases cortas, nada técnico, del Equipo ni de seguridad. */
  publico: string[];
  /** Lo que ve el Equipo en `/equipo/versiones`; `null` en la versión base, sin detalle. */
  equipo: DetalleParaElEquipo | null;
}

/** De la más nueva a la más antigua. */
export const NOVEDADES: readonly Novedad[] = [
  {
    version: '1.11.0',
    fecha: '2026-11-13',
    publico: [
      'Fotos más grandes y en blanco.',
      'El buscador ahora entiende «ram kingston», «m.2 1tb», «case» y más.',
      'Edita tus publicaciones con un toque.',
      'Elige quién ve tu perfil: público, privado u oculto.',
      'Marca una publicación como «No disponible» y di por qué.',
    ],
    equipo: {
      nuevo: [
        'Tiendas fundadoras (máximo 10): día destacado, sello en su perfil y prioridad en el chat.',
        '«Destacar» con fuerza: suave, media o fuerte.',
        'Perfil público, privado u oculto, con solicitudes para seguir en la campanita.',
        'Botón «Editar» en cada publicación.',
        'En modo soporte se puede publicar y editar por la tienda.',
      ],
      cambia: [
        'Inicio: 5 por fila, 4 filas, paginación y sin títulos; el orden es por puntos y con tope por tienda.',
        'Chapitas al pasar el cursor: Recién publicado, Más barato de la galería, Muy buscado hoy y Bajó de precio.',
        'Fondo blanco en fotos y tarjetas, con una línea entre la foto y el nombre.',
        'Un solo buscador en todo el sitio (arriba, Publicar, Pedir en vivo, Mis publicaciones y Catálogo).',
        '«Pausar» pasa a «No disponible» con su motivo.',
        'Perfil de tienda: Lo nuevo de esta semana, Sus mejores precios y Todo, con filtros.',
        'Ficha del producto con miniaturas; la primera es la portada de la tienda.',
        'Pedidos en vivo con foto.',
        'Menú del panel en dos pisos.',
        '«Piloto» pasa a «Tiendas fundadoras».',
        '«Cómo llegar» y «Sobre la tienda» son opcionales.',
      ],
      arregla: [
        'Campanita: el número ya no vuelve con F5 y tocar un aviso lo apaga.',
        'Publicar en modo soporte daba error.',
        '«Catálogo» se cortaba en el menú del panel.',
        'Importar un sinónimo largo daba error 500.',
        'La RAM publicada antes de la 1.10.0 ahora muestra Intel / EXPO.',
        'Al editar decía «¡Listo! Ya puedes publicar».',
      ],
      datos: [
        'Fotos horizontales para RAM, teclados, mouse pads, fuentes, refrigeración líquida, monitores y procesadores.',
        'Intel / EXPO de cada RAM del catálogo.',
      ],
    },
  },
  {
    version: '1.10.0',
    fecha: '2026-11-13',
    publico: [
      'Borra tus publicaciones desde tu perfil.',
      'Marca si tu RAM es para Intel o para Ryzen.',
      'Ahora ves cuando te están escribiendo.',
      'Ajusta tu logo y tu portada.',
    ],
    equipo: {
      nuevo: [
        'Mi cuenta del Equipo: datos, contraseña y sesiones.',
        'Eliminar una tienda para siempre, 24 h después de suspenderla y con tu contraseña.',
        'Borrar desde el propio perfil, de a una o varias, con Deshacer.',
        'Al publicar: «¿Para qué procesador es?» (Intel XMP / EXPO Ryzen) y empaque; filtro Para Intel / Para Ryzen.',
        '«Escribiendo…», ✓✓ en el chat con el Equipo y «¿Lograste cerrar el trato?».',
        'Ajustar logo y zoom en la portada.',
        'Sonidos de mensaje y de pedido en vivo (se apagan en Configuración › Avisos).',
      ],
      cambia: [
        'Primer ingreso: contraseña → Conoce PaseLibre → acuerdos, sin «Listo, ya entraste».',
        'Pedir en vivo · Busco: buscador del catálogo con foto, fotos propias y sin precio.',
        'Cambios de galería o stand sin aprobación; el Equipo decide después (Está bien / Corregir / Deshacer).',
        'Crear cuenta: WhatsApp opcional y contraseña temporal o definitiva.',
        '«Marcar vendido» arriba en el chat; la versión del panel arriba, al lado del logo.',
        'Campanita: el número se va al abrirla; avisos del chat con el Equipo agrupados.',
        'Banda de invitar: en el inicio vuelve a los 2 días; en las secciones, una vez.',
      ],
      arregla: [
        'Fila iluminada en modo oscuro (ya no sale casi blanca).',
        'El número de Solicitudes cuenta también los cambios de galería o stand.',
      ],
      datos: [],
    },
  },
  {
    version: '1.9.1',
    fecha: '2026-11-13',
    publico: ['Los mensajes y los pedidos en vivo llegan al instante, sin recargar.'],
    equipo: {
      nuevo: [],
      cambia: [],
      arregla: [
        'El tiempo real acepta www.paselibre.shop (antes se rechazaba en silencio).',
        'Si se corta el tiempo real, la página revisa sola cada 25 s y avisa «Reconectando…».',
        'El chat con el Equipo se actualiza en vivo en los dos lados, aunque la tienda tenga «No molestar».',
        'Primer ingreso: la cabecera ya no dice «Iniciar sesión» y el tiempo real funciona sin F5.',
      ],
      datos: [],
    },
  },
  {
    version: '1.9.0',
    fecha: '2026-11-12',
    publico: [
      'Recién publicado ahora se recorre fila por fila.',
      'Tu logo se ve en todo el sitio.',
      'Ya están las 7 galerías de Wilson.',
      'La ficha de cada producto se lee más clara.',
    ],
    equipo: {
      nuevo: [
        'Equipo › Galerías: agregar, ordenar y ocultar galerías, y los avisos de «Otra galería».',
        'Plantilla del catálogo en Excel con una pestaña por categoría; el importador lee todas las pestañas.',
        'Barra de avance al subir el ZIP: «Subiendo %» y «Revisando filas».',
        'Recién publicado en 4 filas con flecha por fila (hasta 18 por fila) y «Ver todas».',
      ],
      cambia: [
        'Ícono de «Publicación rápida»: rayo de línea verde, ya no amarillo.',
        'Ficha del producto: fondo, bordes y tablas más marcados.',
        'Logo de la tienda en la cabecera, el inicio, la ficha, los mensajes y el piloto.',
        '«Hace X» pasa debajo de la tarjeta.',
        'Los errores del ZIP dicen el motivo, con conteo por tipo.',
      ],
      arregla: [],
      datos: [
        'Se agregan 5 galerías: CompuPlaza, Galerías Garcilaso, Galería Centro de Lima, Compu Wilson y Galería Global.com.',
      ],
    },
  },
  { version: '1.8.7', fecha: '2026-11-12', publico: [], equipo: null },
];

/** La versión que está corriendo: siempre la primera de `NOVEDADES` (lo revisa una prueba). */
export const VERSION = '1.11.0';

/** Lo que sale en el pie de las tiendas: solo los dos primeros números («1.9»). */
export function versionCorta(version: string = VERSION): string {
  return version.split('.').slice(0, 2).join('.');
}
