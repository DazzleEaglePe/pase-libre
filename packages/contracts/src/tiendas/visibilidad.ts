import { z } from 'zod';

/**
 * Doc 20, puntos 5 y 20: quién ve el perfil de una tienda, las solicitudes para seguir un perfil
 * privado, «Tus seguidores» y las publicaciones del perfil con sus filtros.
 */

/** «¿QUIÉN VE TU PERFIL?» (punto 5). */
export const VISIBILIDADES = ['PUBLICO', 'PRIVADO', 'OCULTO'] as const;
export type VisibilidadPerfil = (typeof VISIBILIDADES)[number];

/** Las tres opciones del selector «Perfil: Público ▾», en su orden, con lo que pasa en cada una. */
export const OPCIONES_VISIBILIDAD: ReadonlyArray<{
  valor: VisibilidadPerfil;
  titulo: string;
  detalle: string;
}> = [
  {
    valor: 'PUBLICO',
    titulo: 'Público',
    detalle: 'Todas las tiendas te encuentran y ven tus publicaciones en el Inicio y el buscador.',
  },
  {
    valor: 'PRIVADO',
    titulo: 'Privado',
    detalle:
      'Te encuentran solo buscando tu nombre exacto. Ven tu nombre, pero tu logo y portada salen borrosos. Para ver tus publicaciones tienen que pedirte seguirte y tú aceptas. Tus publicaciones solo salen a tus seguidores.',
  },
  {
    valor: 'OCULTO',
    titulo: 'Oculto',
    detalle: 'No apareces a nadie: ni en el buscador, ni en el Inicio, ni con tu nombre exacto.',
  },
];

/** `PUT /v1/cuenta/visibilidad`: el selector «Perfil: Público ▾». */
export const visibilidadPerfilSchema = z
  .object({ visibilidad: z.enum(VISIBILIDADES, 'Elige quién ve tu perfil.') })
  .strict();
export type VisibilidadPerfilDatos = z.infer<typeof visibilidadPerfilSchema>;

export interface RespuestaVisibilidad {
  visibilidad: VisibilidadPerfil;
}

/** `POST` y `DELETE /v1/tiendas/:id/solicitud`: «Solicitar seguir» y cancelarla. */
export interface RespuestaSolicitudSeguir {
  solicitud_enviada: boolean;
}

/** `POST /v1/solicitudes-seguir/:id/aceptar` y `/rechazar`: lo que queda en la campana. */
export interface RespuestaResolverSolicitud {
  /** «Ahora Tecno Wilson te sigue» o «Rechazaste la solicitud de Tecno Wilson». */
  mensaje: string;
}

/** Una tienda en «Tus seguidores (N)» (punto 5). */
export interface Seguidora {
  id: string;
  nombre: string;
  iniciales: string;
  galeria: string | null;
  desde: string;
}

/** `GET /v1/cuenta/seguidores`. */
export interface RespuestaSeguidores {
  seguidoras: Seguidora[];
  total: number;
}

// ── Punto 20: las publicaciones del perfil ────────────────────────────────

/** «Ordenar ▾» de «Todo», en su orden. «Recién publicados» va por defecto. */
export const ORDENES_PERFIL = [
  'recientes',
  'precio_asc',
  'precio_desc',
  'vistos',
  'remates',
] as const;
export type OrdenPerfil = (typeof ORDENES_PERFIL)[number];

export const TEXTO_ORDEN_PERFIL: Record<OrdenPerfil, string> = {
  recientes: 'Recién publicados',
  precio_asc: 'Precio: menor a mayor',
  precio_desc: 'Precio: mayor a menor',
  vistos: 'Más vistos',
  remates: 'Remates primero',
};

/**
 * `GET /v1/tiendas/:id/publicaciones?categoria=ram,teclados&orden=precio_asc&pagina=1`: «Todo»
 * del perfil. Con varias categorías, se suman.
 */
export const publicacionesTiendaSchema = z.object({
  categoria: z
    .string()
    .max(400)
    .optional()
    .transform((texto) =>
      (texto ?? '')
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  orden: z.enum(ORDENES_PERFIL).default('recientes'),
  pagina: z.coerce.number().int().min(1).max(200).default(1),
});
export type PublicacionesTiendaConsulta = z.output<typeof publicacionesTiendaSchema>;

/** Una burbuja de «Todo»: «Memoria RAM · 6». */
export interface CategoriaDelPerfil {
  slug: string;
  nombre: string;
  cantidad: number;
}
