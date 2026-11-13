-- Perfil Público / Privado / Oculto (doc 20, punto 5). `tienda.perfil_privado` (de la fase 2, sin
-- uso) pasa a `tienda.visibilidad`: las que lo tenían en true quedan PRIVADO y la columna se borra.
-- Segura con datos reales: la columna nueva entra con su valor por defecto (sin reescribir la
-- tabla), se copia lo de antes y recién después se borra la vieja.

-- CreateEnum
CREATE TYPE "visibilidad_perfil" AS ENUM ('PUBLICO', 'PRIVADO', 'OCULTO');

-- `producto_resumen` (docs/16 §4.4) cuenta lo que ve un visitante: desde ahora, solo las ofertas de
-- tiendas públicas. Lo de una privada lo ven sus seguidoras y lo de una oculta nadie: la búsqueda
-- lo saca de las ofertas (ver `tiendasQueNoVeo` en la API). Se cambian antes de copiar los datos:
-- así el trigger de `tienda` ya refresca los productos de las que quedan privadas.
CREATE OR REPLACE FUNCTION producto_resumen_refrescar(ids UUID[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ids IS NULL OR cardinality(ids) = 0 THEN
    RETURN;
  END IF;
  PERFORM 1 FROM producto WHERE id = ANY (ids) ORDER BY id FOR NO KEY UPDATE;

  DELETE FROM producto_resumen WHERE producto_id = ANY (ids);

  INSERT INTO producto_resumen (
    producto_id, categoria_id, marca_id, titulo, ofertas, stock, nuevas, usadas, con_stock,
    galerias, actualizada_en, desde_usd, desde_pen, barata_usd, barata_pen, al_interno
  )
  SELECT p.id, p.categoria_id, p.marca_id, p.titulo,
         sum(a.ofertas), sum(a.stock), sum(a.nuevas), sum(a.usadas), sum(a.con_stock),
         jsonb_object_agg(a.galeria, a.ofertas), max(a.actualizada_en),
         min(a.desde_usd), min(a.desde_pen), min(a.barata_usd), min(a.barata_pen),
         sum(a.al_interno)
  FROM (
    SELECT o.producto_id,
           coalesce(t.galeria_id::text, 'independientes') AS galeria,
           count(*)::int AS ofertas,
           sum(o.stock)::int AS stock,
           count(*) FILTER (WHERE o.condicion = 'NUEVO')::int AS nuevas,
           count(*) FILTER (WHERE o.condicion = 'USADO')::int AS usadas,
           count(*) FILTER (WHERE o.stock > 0)::int AS con_stock,
           max(o.actualizada_en) AS actualizada_en,
           min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'USD') AS desde_usd,
           min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'PEN') AS desde_pen,
           min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'USD' AND o.stock > 0) AS barata_usd,
           min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'PEN' AND o.stock > 0) AS barata_pen,
           count(*) FILTER (WHERE NOT o.precio_visible OR o.precio_centimos IS NULL)::int AS al_interno
    FROM oferta o
    JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA' AND t.visibilidad = 'PUBLICO'
    WHERE o.producto_id = ANY (ids) AND o.estado = 'ACTIVA'
    GROUP BY o.producto_id, t.galeria_id
  ) a
  JOIN producto p ON p.id = a.producto_id AND p.fusionado_en_id IS NULL
  GROUP BY p.id;
END
$$;

-- Tiendas suspendidas, reactivadas, cambiadas de galería o de visibilidad.
CREATE OR REPLACE FUNCTION producto_resumen_tiendas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(
    SELECT DISTINCT o.producto_id
    FROM nuevas n
    JOIN viejas v ON v.id = n.id
    JOIN oferta o ON o.tienda_id = n.id AND o.estado = 'ACTIVA'
    WHERE (n.estado, n.galeria_id, n.visibilidad) IS DISTINCT FROM (v.estado, v.galeria_id, v.visibilidad)
  ));
  RETURN NULL;
END
$$;

-- AlterTable: la columna nueva no reescribe la tabla (el valor por defecto es constante).
ALTER TABLE "tienda" ADD COLUMN "visibilidad" "visibilidad_perfil" NOT NULL DEFAULT 'PUBLICO';

-- Lo que ya estaba marcado como privado sigue privado (dispara el refresco del resumen).
UPDATE "tienda" SET "visibilidad" = 'PRIVADO' WHERE "perfil_privado";

-- AlterTable
ALTER TABLE "tienda" DROP COLUMN "perfil_privado";
