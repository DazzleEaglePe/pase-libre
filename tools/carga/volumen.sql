-- Volumen para la prueba de carga: 150 tiendas más, cada una con su dueño (`carga001`…`carga150`,
-- con la misma clave que `tiendaa`) y unas 15 ofertas de productos que ya existen.
-- SOLO en una base de prueba. Se corre con:
--   docker exec -i paselibre-local-postgres-1 psql -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/volumen.sql
DO $$
BEGIN
  IF current_database() NOT LIKE '%carga%' THEN
    RAISE EXCEPTION 'volumen.sql solo corre en una base cuyo nombre diga «carga» (esta es %)', current_database();
  END IF;
END $$;

WITH galerias AS (
  SELECT id, row_number() OVER (ORDER BY nombre) AS n, count(*) OVER () AS total FROM galeria
),
nuevas AS (
  INSERT INTO tienda (tipo, nombre, galeria_id, stand, whatsapp, horario)
  SELECT 'TIENDA', 'Tienda de carga ' || lpad(i::text, 3, '0'),
         (SELECT id FROM galerias WHERE n = 1 + (i % (SELECT max(total) FROM galerias))),
         (100 + i)::text, '9' || lpad((80000000 + i)::text, 8, '0'), 'Lun a sáb, de 10:00 a. m. a 8:00 p. m.'
  FROM generate_series(1, 150) AS i
  RETURNING id, nombre
)
INSERT INTO usuario (tienda_id, rol, usuario, nombre, whatsapp, clave_hash, debe_cambiar_clave, primer_ingreso_en)
SELECT nuevas.id, 'DUENO', 'carga' || right(nuevas.nombre, 3), 'Encargado ' || right(nuevas.nombre, 3),
       NULL, (SELECT clave_hash FROM usuario WHERE usuario = 'tiendaa'), false, now()
FROM nuevas;

-- 15 productos al azar por tienda, con precio, condición y stock variados.
INSERT INTO oferta (producto_id, tienda_id, responsable_id, condicion, stock, precio_centimos, moneda, precio_visible, estado, actualizada_en, creada_en)
SELECT p.id, u.tienda_id, u.id,
       CASE WHEN random() < 0.85 THEN 'NUEVO' ELSE 'USADO' END::condicion,
       (random() * 8)::int,
       (5000 + random() * 120000)::bigint,
       CASE WHEN random() < 0.7 THEN 'USD' ELSE 'PEN' END::moneda,
       random() < 0.6,
       'ACTIVA',
       now() - (random() * interval '20 days'),
       now() - (random() * interval '20 days')
FROM usuario u
CROSS JOIN LATERAL (
  SELECT id FROM producto WHERE fusionado_en_id IS NULL ORDER BY random() + (u.id::text < '') ::int LIMIT 15
) p
WHERE u.usuario LIKE 'carga%'
ON CONFLICT DO NOTHING;

SELECT (SELECT count(*) FROM tienda) AS tiendas, (SELECT count(*) FROM oferta WHERE estado = 'ACTIVA') AS ofertas_activas,
       (SELECT count(*) FROM producto) AS productos;
