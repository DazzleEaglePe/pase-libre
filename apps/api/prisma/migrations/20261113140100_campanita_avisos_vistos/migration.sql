-- docs/19 punto 15: el número naranja de la campanita cuenta los avisos que llegaron desde la
-- última vez que se abrió. Nula: nunca la abrió y cuenta todos los sin leer, como hasta ahora.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "avisos_vistos_en" TIMESTAMPTZ(6);
