-- Reparte en los últimos 60 días las fechas de las ofertas sintéticas de catalogo-grande.sql.
-- Ese guion las crea todas en la misma sentencia, con la misma fecha: «Recién publicado» de la
-- portada tiene que ordenar las 180 mil para elegir 16, algo que no pasa con fechas reales. Se
-- corre después de catalogo-grande.sql para medir con fechas como las de verdad (tools/carga/README.md):
--   docker exec -i paselibre-local-postgres-1 psql -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/fechas-repartidas.sql
DO $$
BEGIN
  IF current_database() NOT LIKE '%carga%' THEN
    RAISE EXCEPTION 'fechas-repartidas.sql solo corre en una base cuyo nombre diga «carga» (esta es %)', current_database();
  END IF;
END $$;

UPDATE oferta o
SET creada_en = now() - make_interval(secs => f.antes),
    actualizada_en = now() - make_interval(secs => f.antes) + make_interval(secs => f.despues)
FROM (
  SELECT x.id, abs(hashtext(x.id::text || 'a')) % (60 * 24 * 3600) AS antes,
         abs(hashtext(x.id::text || 'b')) % greatest(1, abs(hashtext(x.id::text || 'a')) % (60 * 24 * 3600)) AS despues
  FROM oferta x JOIN producto p ON p.id = x.producto_id
  WHERE p.slug LIKE 'sint-%'
) f
WHERE f.id = o.id;
ANALYZE oferta;
SELECT count(DISTINCT actualizada_en) AS fechas_distintas, min(actualizada_en), max(actualizada_en) FROM oferta;
