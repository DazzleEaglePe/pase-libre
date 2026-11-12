-- docs/18 §3: las 7 galerías de la avenida, en su orden, y los avisos «Galería nueva: …» de
-- Equipo › Galerías. Se puede correr dos veces sin cambiar nada: las que ya están (Maxiplaza y
-- Cyberplaza tienen tiendas) no se renombran ni se borran; solo reciben su `orden`.

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN IF NOT EXISTS "galeria_otra_resuelta_en" TIMESTAMPTZ(6);

-- Las que faltan, por slug. Si ya hay una con el mismo nombre (escrito con otras mayúsculas),
-- se deja la que está.
INSERT INTO "galeria" ("nombre", "slug", "orden")
SELECT v.nombre, v.slug, v.orden
FROM (VALUES
  ('CyberPlaza', 'cyberplaza', 1),
  ('CompuPlaza', 'compuplaza', 2),
  ('Galerías Garcilaso', 'galerias-garcilaso', 3),
  ('MaxiPlaza', 'maxiplaza', 4),
  ('Galería Centro de Lima', 'galeria-centro-de-lima', 5),
  ('Compu Wilson', 'compu-wilson', 6),
  ('Galería Global.com', 'galeria-global-com', 7)
) AS v ("nombre", "slug", "orden")
WHERE NOT EXISTS (SELECT 1 FROM "galeria" g WHERE lower(g."nombre") = lower(v.nombre))
ON CONFLICT ("slug") DO NOTHING;

-- El orden de la avenida para las 7, estén o no recién creadas.
UPDATE "galeria" g
SET "orden" = v.orden
FROM (VALUES
  ('cyberplaza', 1),
  ('compuplaza', 2),
  ('galerias-garcilaso', 3),
  ('maxiplaza', 4),
  ('galeria-centro-de-lima', 5),
  ('compu-wilson', 6),
  ('galeria-global-com', 7)
) AS v ("slug", "orden")
WHERE g."slug" = v.slug;

-- Si hubiera alguna otra, va después de las 7, en el orden que tenía.
UPDATE "galeria" g
SET "orden" = 7 + o.puesto
FROM (
  SELECT "id", row_number() OVER (ORDER BY "orden", "nombre")::int AS puesto
  FROM "galeria"
  WHERE "slug" NOT IN ('cyberplaza', 'compuplaza', 'galerias-garcilaso', 'maxiplaza',
                       'galeria-centro-de-lima', 'compu-wilson', 'galeria-global-com')
) AS o
WHERE g."id" = o."id";
