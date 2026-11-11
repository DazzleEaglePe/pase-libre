-- «Otro» en el estado y en la garantía al publicar (COR9 del lienzo final): quien publica
-- escribe el texto, hasta 40 letras.

-- AlterEnum
ALTER TYPE "estado_detalle" ADD VALUE 'OTRO';

-- AlterEnum
ALTER TYPE "garantia" ADD VALUE 'OTRA';

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "estado_otro" VARCHAR(40),
ADD COLUMN     "garantia_otra" VARCHAR(40);

