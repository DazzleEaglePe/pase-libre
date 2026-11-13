-- «Ajustar logo» y zoom en la portada (docs/19 §20).
-- · `tienda.logo_original` y `tienda.logo_ajuste`: la foto que se subió y cómo se acomodó
--   (`{ x, y, zoom, rotacion, fondo }`). `tienda.logo` sigue siendo el logo que se ve en todos
--   lados: ahora es el cuadrado de 512 × 512 que arma la API.
-- · `tienda.portada_zoom` (de 1 a 4) y `tienda.portada_x` (de 0 a 100, a lo ancho): «Acomodar»
--   también acerca y mueve a los costados.

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "logo_ajuste" JSONB,
ADD COLUMN     "logo_original" VARCHAR(300),
ADD COLUMN     "portada_x" SMALLINT NOT NULL DEFAULT 50,
ADD COLUMN     "portada_zoom" REAL NOT NULL DEFAULT 1;
