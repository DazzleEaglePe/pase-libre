-- doc 19, punto 21: el busco lleva fotos (hasta 3). Rutas de /media: la del catálogo o las que
-- subió la tienda. La primera es la que ven las tiendas.

-- AlterTable
ALTER TABLE "en_vivo" ADD COLUMN "fotos" VARCHAR(300)[] DEFAULT ARRAY[]::VARCHAR(300)[];

ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_fotos_hasta_3" CHECK (cardinality("fotos") <= 3);
