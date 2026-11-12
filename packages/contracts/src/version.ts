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
export const VERSION = '1.9.0';

/** Lo que sale en el pie de las tiendas: solo los dos primeros números («1.9»). */
export function versionCorta(version: string = VERSION): string {
  return version.split('.').slice(0, 2).join('.');
}
