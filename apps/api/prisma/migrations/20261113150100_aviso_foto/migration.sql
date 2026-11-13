-- doc 19, punto 21: el aviso de un pedido en vivo lleva su foto (nula en los demás avisos).

-- AlterTable
ALTER TABLE "aviso" ADD COLUMN "foto" VARCHAR(300);
