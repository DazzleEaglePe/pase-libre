-- Precios en soles por defecto (guía del lienzo final): las tiendas nuevas publican en S/ y
-- las que ya están también; cada una puede volver a dólares en Configuración.

-- AlterTable
ALTER TABLE "tienda" ALTER COLUMN "moneda_defecto" SET DEFAULT 'PEN';


UPDATE "tienda" SET "moneda_defecto" = 'PEN' WHERE "moneda_defecto" = 'USD';
