-- «¿Por qué la pausas?» y las vistas de la semana de Mis publicaciones (MP_Web, sección 12 del lienzo final).

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "razon_pausa" VARCHAR(60);

-- CreateTable
CREATE TABLE "vista_oferta" (
    "oferta_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "dia" DATE NOT NULL,

    CONSTRAINT "vista_oferta_pkey" PRIMARY KEY ("oferta_id","tienda_id","dia")
);

-- CreateIndex
CREATE INDEX "vista_oferta_oferta_id_dia_idx" ON "vista_oferta"("oferta_id", "dia");

-- AddForeignKey
ALTER TABLE "vista_oferta" ADD CONSTRAINT "vista_oferta_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vista_oferta" ADD CONSTRAINT "vista_oferta_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

