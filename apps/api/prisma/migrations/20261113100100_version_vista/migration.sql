-- doc 19, punto 8: la última versión que cada persona abrió en Equipo › Versiones. Sin ella, o
-- con otra, la pastilla de la versión lleva el puntito verde.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "version_vista" VARCHAR(20);
