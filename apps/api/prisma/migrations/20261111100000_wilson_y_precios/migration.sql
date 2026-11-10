-- Wilson en vivo (distancia entre galerías), «Bajó de precio» y el precio de pase por día (sección 8 del lienzo final).

-- AlterTable
ALTER TABLE "galeria" ADD COLUMN     "metros" INTEGER;

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "precio_anterior_centimos" BIGINT,
ADD COLUMN     "precio_bajo_en" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "precio_diario" (
    "producto_id" UUID NOT NULL,
    "dia" DATE NOT NULL,
    "moneda" "moneda" NOT NULL,
    "minimo_centimos" BIGINT NOT NULL,
    "promedio_centimos" BIGINT NOT NULL,
    "ofertas" INTEGER NOT NULL,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precio_diario_pkey" PRIMARY KEY ("producto_id","dia")
);

-- AddForeignKey
ALTER TABLE "precio_diario" ADD CONSTRAINT "precio_diario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

