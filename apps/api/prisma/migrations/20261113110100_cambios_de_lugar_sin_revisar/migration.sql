-- doc 19 §10: el cambio de galería o stand se aplica al guardar y queda APLICADO_SIN_REVISAR, con
-- lo de antes para «Deshacer». «Otra galería» (una que no está en la lista) sigue pendiente: va
-- sin galería y con el nombre que escribió la tienda.

-- AlterEnum
ALTER TYPE "estado_cambio_lugar" ADD VALUE 'APLICADO_SIN_REVISAR';

-- AlterTable
ALTER TABLE "cambio_lugar" ADD COLUMN "galeria_otra" VARCHAR(120),
ADD COLUMN "galeria_antes_id" UUID,
ADD COLUMN "piso_antes" VARCHAR(20),
ADD COLUMN "stand_antes" VARCHAR(20),
ALTER COLUMN "galeria_id" DROP NOT NULL;

-- Siempre una galería de la lista o una «Otra galería» escrita (al confirmarla, quedan las dos).
ALTER TABLE "cambio_lugar" ADD CONSTRAINT "cambio_lugar_galeria_o_otra_check"
  CHECK ("galeria_id" IS NOT NULL OR "galeria_otra" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "cambio_lugar" ADD CONSTRAINT "cambio_lugar_galeria_antes_id_fkey" FOREIGN KEY ("galeria_antes_id") REFERENCES "galeria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
