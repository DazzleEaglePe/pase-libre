-- Las 21 categorías del lienzo «Versión final» (CAT_Web1), en cuatro grupos. Las siete de
-- antes conservan su slug (los enlaces viejos siguen sirviendo); «Periféricos» deja de ser una
-- categoría y pasa a ser un grupo: sus productos se reparten por el título.

ALTER TABLE "categoria" ADD COLUMN "grupo" VARCHAR(40);

INSERT INTO "categoria" ("nombre", "slug", "orden", "grupo") VALUES
  ('Procesadores', 'procesadores', 1, 'Componentes'),
  ('Tarjetas de video', 'graficas', 2, 'Componentes'),
  ('Placas madre', 'placas', 3, 'Componentes'),
  ('Memoria RAM', 'ram', 4, 'Componentes'),
  ('Almacenamiento', 'almacenamiento', 5, 'Componentes'),
  ('Fuentes de poder', 'fuentes', 6, 'Componentes'),
  ('Cases', 'cases', 7, 'Componentes'),
  ('Refrigeración', 'refrigeracion', 8, 'Componentes'),
  ('Laptops', 'laptops', 9, 'Equipos'),
  ('PCs armadas', 'pcs-armadas', 10, 'Equipos'),
  ('Monitores', 'monitores', 11, 'Equipos'),
  ('Teclados', 'teclados', 12, 'Periféricos'),
  ('Mouse', 'mouse', 13, 'Periféricos'),
  ('Mouse pads', 'mouse-pads', 14, 'Periféricos'),
  ('Audífonos y parlantes', 'audio', 15, 'Periféricos'),
  ('Micrófonos y cámaras', 'microfonos-camaras', 16, 'Periféricos'),
  ('Estabilizadores y UPS', 'energia', 17, 'Energía, redes y más'),
  ('Redes', 'redes', 18, 'Energía, redes y más'),
  ('Sillas gamer', 'sillas', 19, 'Energía, redes y más'),
  ('Soportes', 'soportes', 20, 'Energía, redes y más'),
  ('Accesorios', 'accesorios', 21, 'Energía, redes y más')
ON CONFLICT ("slug") DO UPDATE
  SET "nombre" = EXCLUDED."nombre", "orden" = EXCLUDED."orden", "grupo" = EXCLUDED."grupo";

-- Lo que estaba en «Periféricos», a su categoría nueva según el título.
WITH destino AS (
  SELECT p.id AS producto_id,
         CASE
           WHEN p.titulo ILIKE '%mouse pad%' OR p.titulo ILIKE '%mousepad%' OR p.titulo ILIKE '%pad gamer%' THEN 'mouse-pads'
           WHEN p.titulo ILIKE '%mouse%' OR p.titulo ILIKE '%rat_n%' THEN 'mouse'
           WHEN p.titulo ILIKE '%teclado%' OR p.titulo ILIKE '%keyboard%' THEN 'teclados'
           WHEN p.titulo ILIKE '%aud_fono%' OR p.titulo ILIKE '%auricular%' OR p.titulo ILIKE '%headset%'
                OR p.titulo ILIKE '%parlante%' OR p.titulo ILIKE '%speaker%' THEN 'audio'
           WHEN p.titulo ILIKE '%micr_fono%' OR p.titulo ILIKE '%webcam%' OR p.titulo ILIKE '%c_mara%' THEN 'microfonos-camaras'
           ELSE 'accesorios'
         END AS slug
  FROM "producto" p
  JOIN "categoria" c ON c.id = p.categoria_id AND c.slug = 'perifericos'
)
UPDATE "producto" p
SET "categoria_id" = nueva.id
FROM destino d
JOIN "categoria" nueva ON nueva.slug = d.slug
WHERE p.id = d.producto_id;

UPDATE "en_vivo" e
SET "categoria_id" = (SELECT id FROM "categoria" WHERE slug = 'accesorios')
WHERE e.categoria_id = (SELECT id FROM "categoria" WHERE slug = 'perifericos');

DELETE FROM "categoria" WHERE slug = 'perifericos';
