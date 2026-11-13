-- docs/19 punto 14: la banda «¿Conoces una tienda…?» en las secciones de la barra negra. Su X
-- es aparte de la del inicio (`invitar_cerrado_en`, que ahora vuelve a los 2 días): si la
-- cierran en una sección, no vuelve más en ninguna.

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "invitar_secciones_cerrado_en" TIMESTAMPTZ(6);
