-- «Mostrarlo» del presupuesto de un busco (PUB_WebVivo, sección 9 del lienzo final).

-- AlterTable
ALTER TABLE "en_vivo" ADD COLUMN     "mostrar_precio" BOOLEAN NOT NULL DEFAULT true;

