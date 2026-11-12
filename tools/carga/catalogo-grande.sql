-- Catálogo grande para la prueba de carga (docs/16 §3): ~60 000 productos y ~180 000 ofertas sintéticas
-- (títulos con palabras de PC al azar; slug «sint-N»). SOLO en una base de prueba. Se corre con:
--   docker exec -i paselibre-local-postgres-1 psql -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/catalogo-grande.sql
-- Se puede repetir: borra primero lo que cargó antes.
DO $$
BEGIN
  IF current_database() NOT LIKE '%carga%' THEN
    RAISE EXCEPTION 'catalogo-grande.sql solo corre en una base cuyo nombre diga «carga» (esta es %)', current_database();
  END IF;
END $$;

DELETE FROM oferta WHERE producto_id IN (SELECT id FROM producto WHERE slug LIKE 'sint-%');
DELETE FROM producto WHERE slug LIKE 'sint-%';
WITH palabras AS (
  SELECT ARRAY['ryzen','intel','core','rtx','geforce','radeon','ssd','nvme','ddr4','ddr5','monitor','teclado','mouse','laptop','asus','msi','gigabyte','corsair','kingston','samsung','lg','hp','lenovo','dell','case','fuente','placa','cooler','gamer','pro','plus','ultra','oled','ips','curvo','inalambrico','rgb','mecanico','tuf','rog','predator','aorus','blackwell','ti','super','xt','vengeance'] AS p
), c AS (SELECT array_agg(id) a FROM categoria), m AS (SELECT array_agg(id) a FROM marca),
base AS (
  SELECT g,
    (palabras.p[1 + (abs(hashtext(g::text||'a')) % cardinality(palabras.p))] || ' ' || palabras.p[1 + (abs(hashtext(g::text||'b')) % cardinality(palabras.p))] || ' ' ||
     palabras.p[1 + (abs(hashtext(g::text||'c')) % cardinality(palabras.p))] || ' ' || (1000 + abs(hashtext(g::text||'d')) % 9000)::text) AS t,
    c.a[1 + (abs(hashtext(g::text||'e')) % cardinality(c.a))] AS cat,
    m.a[1 + (abs(hashtext(g::text||'f')) % cardinality(m.a))] AS marca
  FROM generate_series(1, 60000) g, palabras, c, m
)
INSERT INTO producto (categoria_id, marca_id, titulo, slug, texto_busqueda)
SELECT cat, marca, initcap(t), 'sint-' || g, lower(t) FROM base;

INSERT INTO oferta (producto_id, tienda_id, responsable_id, condicion, stock, precio_centimos, moneda, precio_visible, estado)
SELECT p.id, t.id, (SELECT id FROM usuario LIMIT 1), cond.c, 1 + (abs(hashtext(p.id::text)) % 5),
       (5000 + abs(hashtext(p.id::text || t.id::text)) % 400000)::bigint,
       (CASE WHEN abs(hashtext(t.id::text || p.id::text)) % 2 = 0 THEN 'PEN' ELSE 'USD' END)::moneda, true, 'ACTIVA'
FROM producto p, tienda t, (VALUES ('NUEVO'::condicion), ('USADO'::condicion)) cond(c)
WHERE p.slug LIKE 'sint-%' AND abs(hashtext(p.id::text || t.id::text || cond.c::text)) % 4 = 0
ON CONFLICT DO NOTHING;
ANALYZE;
SELECT 'productos', count(*), count(DISTINCT texto_busqueda) FROM producto UNION ALL SELECT 'ofertas', count(*), 0 FROM oferta;
SELECT 'con ryzen', count(*) FROM producto WHERE texto_busqueda LIKE '%ryzen%';
