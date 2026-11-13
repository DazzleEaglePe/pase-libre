-- doc 20, punto 4b: «Destacar» con fuerza. Solo suma puntos en el Inicio (Suave +20, Media +40,
-- Fuerte +70). Las de hoy quedan como MEDIA.

-- CreateEnum
CREATE TYPE "fuerza_destacado" AS ENUM ('SUAVE', 'MEDIA', 'FUERTE');

-- AlterTable
ALTER TABLE "destacado" ADD COLUMN "fuerza" "fuerza_destacado" NOT NULL DEFAULT 'MEDIA';
