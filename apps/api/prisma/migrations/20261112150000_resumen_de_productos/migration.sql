-- Resumen de las ofertas vigentes de cada producto (docs/16 §4.4). Con 60 mil productos y 180 mil
-- ofertas, buscar sin texto o por categoría agrupaba todas las ofertas en cada pedido (1,2 s).
-- `producto_resumen` tiene una fila por producto con al menos una oferta que ve un visitante
-- (oferta activa, tienda activa y producto sin unir a otro): cuántas ofertas, stock, condiciones,
-- ofertas por galería, la más reciente y los menores precios **visibles** (`precio_visible`; el
-- visitante nunca los pide). La búsqueda lo lee en lugar de las ofertas cuando no filtra por algo
-- de la oferta (galería, condición, stock o precio) ni quien mira bloqueó tiendas.
--
-- Lo mantienen triggers de la base, no la API: así sigue al día al publicar, editar, pausar,
-- vender o borrar una oferta, al suspender una tienda o cambiarla de galería, y al cambiar la
-- categoría, la marca o el título de un producto o unirlo a otro, venga el cambio de la API, de
-- las semillas, de las pruebas o de SQL a mano. Los triggers son por sentencia: una carga de miles
-- de ofertas refresca cada producto una sola vez.

-- CreateTable
CREATE TABLE "producto_resumen" (
    "producto_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "marca_id" UUID,
    "titulo" VARCHAR(200) NOT NULL,
    "ofertas" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "nuevas" INTEGER NOT NULL,
    "usadas" INTEGER NOT NULL,
    "con_stock" INTEGER NOT NULL,
    "galerias" JSONB NOT NULL,
    "actualizada_en" TIMESTAMPTZ(6) NOT NULL,
    "desde_usd" BIGINT,
    "desde_pen" BIGINT,
    "barata_usd" BIGINT,
    "barata_pen" BIGINT,
    "al_interno" INTEGER NOT NULL,

    CONSTRAINT "producto_resumen_pkey" PRIMARY KEY ("producto_id")
);

-- CreateIndex
CREATE INDEX "producto_resumen_actualizada_en_titulo_idx" ON "producto_resumen"("actualizada_en" DESC, "titulo");

-- CreateIndex
CREATE INDEX "producto_resumen_categoria_id_actualizada_en_titulo_idx" ON "producto_resumen"("categoria_id", "actualizada_en" DESC, "titulo");

-- Vuelve a calcular el resumen de esos productos desde sus ofertas.
CREATE FUNCTION producto_resumen_refrescar(ids UUID[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ids IS NULL OR cardinality(ids) = 0 THEN
    RETURN;
  END IF;
  -- Un refresco a la vez por producto: se espera a quien esté refrescando el mismo y recién
  -- después se leen las ofertas (en READ COMMITTED cada sentencia ve lo ya confirmado). Así dos
  -- tiendas que publican a la vez el mismo producto no se pisan el resumen. `NO KEY UPDATE` no
  -- estorba a quien solo inserta ofertas que apuntan al producto.
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
    JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
    WHERE o.producto_id = ANY (ids) AND o.estado = 'ACTIVA'
    GROUP BY o.producto_id, t.galeria_id
  ) a
  JOIN producto p ON p.id = a.producto_id AND p.fusionado_en_id IS NULL
  GROUP BY p.id;
END
$$;

-- Ofertas nuevas.
CREATE FUNCTION producto_resumen_ofertas_nuevas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(SELECT DISTINCT producto_id FROM nuevas));
  RETURN NULL;
END
$$;

-- Ofertas que cambiaron algo que el resumen cuenta (y, si cambiaron de producto, también el de antes).
CREATE FUNCTION producto_resumen_ofertas_cambiadas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(
    SELECT n.producto_id
    FROM nuevas n JOIN viejas v ON v.id = n.id
    WHERE (n.producto_id, n.tienda_id, n.condicion, n.stock, n.precio_centimos, n.moneda,
           n.precio_visible, n.estado, n.actualizada_en)
          IS DISTINCT FROM
          (v.producto_id, v.tienda_id, v.condicion, v.stock, v.precio_centimos, v.moneda,
           v.precio_visible, v.estado, v.actualizada_en)
    UNION
    SELECT v.producto_id
    FROM nuevas n JOIN viejas v ON v.id = n.id
    WHERE n.producto_id <> v.producto_id
  ));
  RETURN NULL;
END
$$;

-- Ofertas borradas.
CREATE FUNCTION producto_resumen_ofertas_borradas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(SELECT DISTINCT producto_id FROM viejas));
  RETURN NULL;
END
$$;

-- Tiendas suspendidas, reactivadas o cambiadas de galería: los productos de sus ofertas activas.
CREATE FUNCTION producto_resumen_tiendas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(
    SELECT DISTINCT o.producto_id
    FROM nuevas n
    JOIN viejas v ON v.id = n.id
    JOIN oferta o ON o.tienda_id = n.id AND o.estado = 'ACTIVA'
    WHERE (n.estado, n.galeria_id) IS DISTINCT FROM (v.estado, v.galeria_id)
  ));
  RETURN NULL;
END
$$;

-- Productos con otra categoría, marca o título, o unidos a otro.
CREATE FUNCTION producto_resumen_productos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM producto_resumen_refrescar(ARRAY(
    SELECT n.id
    FROM nuevas n JOIN viejas v ON v.id = n.id
    WHERE (n.categoria_id, n.marca_id, n.titulo, n.fusionado_en_id)
          IS DISTINCT FROM (v.categoria_id, v.marca_id, v.titulo, v.fusionado_en_id)
  ));
  RETURN NULL;
END
$$;

CREATE TRIGGER producto_resumen_oferta_insertada AFTER INSERT ON oferta
  REFERENCING NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION producto_resumen_ofertas_nuevas();
CREATE TRIGGER producto_resumen_oferta_cambiada AFTER UPDATE ON oferta
  REFERENCING OLD TABLE AS viejas NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION producto_resumen_ofertas_cambiadas();
CREATE TRIGGER producto_resumen_oferta_borrada AFTER DELETE ON oferta
  REFERENCING OLD TABLE AS viejas
  FOR EACH STATEMENT EXECUTE FUNCTION producto_resumen_ofertas_borradas();
CREATE TRIGGER producto_resumen_tienda_cambiada AFTER UPDATE ON tienda
  REFERENCING OLD TABLE AS viejas NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION producto_resumen_tiendas();
CREATE TRIGGER producto_resumen_producto_cambiado AFTER UPDATE ON producto
  REFERENCING OLD TABLE AS viejas NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION producto_resumen_productos();

-- Lo que ya está publicado.
SELECT producto_resumen_refrescar(ARRAY(SELECT DISTINCT producto_id FROM oferta WHERE estado = 'ACTIVA'));
ANALYZE producto_resumen;
