-- Versión («OC», «Normal») y código de parte del producto (COR9 y COR15 del lienzo final). Dos
-- productos no comparten código: el catálogo nunca une productos con códigos distintos.

-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "codigo_parte" CITEXT,
ADD COLUMN     "version" VARCHAR(40);

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_parte_key" ON "producto"("codigo_parte");

