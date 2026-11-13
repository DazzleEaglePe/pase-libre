-- doc 19, punto 22: Configuración › Avisos › «Sonido». Prendido de entrada.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "sonido" BOOLEAN NOT NULL DEFAULT true;
