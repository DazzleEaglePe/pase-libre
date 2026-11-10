-- Seguir a una tienda (SG_Web) y opinar después de una venta (PCH_CelCalificar, SG_WebOpiniones).

-- CreateEnum
CREATE TYPE "avisos_seguimiento" AS ENUM ('TODO', 'IMPORTANTE', 'NINGUNO');

-- CreateEnum
CREATE TYPE "lado_opinion" AS ENUM ('COMPRADOR', 'VENDEDOR');

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "seguir_explicado_en" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "seguimiento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "seguida_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "avisos" "avisos_seguimiento" NOT NULL DEFAULT 'IMPORTANTE',
    "avisado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opinion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venta_id" UUID NOT NULL,
    "lado" "lado_opinion" NOT NULL,
    "autor_tienda_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "estrellas" SMALLINT NOT NULL,
    "aspectos" VARCHAR(40)[],
    "texto" VARCHAR(500),
    "respuesta" VARCHAR(500),
    "respondida_en" TIMESTAMPTZ(6),
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opinion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seguimiento_seguida_id_idx" ON "seguimiento"("seguida_id");

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_tienda_id_seguida_id_key" ON "seguimiento"("tienda_id", "seguida_id");

-- CreateIndex
CREATE INDEX "opinion_tienda_id_creada_en_idx" ON "opinion"("tienda_id", "creada_en" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "opinion_venta_id_lado_key" ON "opinion"("venta_id", "lado");

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_seguida_id_fkey" FOREIGN KEY ("seguida_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opinion" ADD CONSTRAINT "opinion_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opinion" ADD CONSTRAINT "opinion_autor_tienda_id_fkey" FOREIGN KEY ("autor_tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opinion" ADD CONSTRAINT "opinion_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opinion" ADD CONSTRAINT "opinion_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- De 1 a 5 estrellas.
ALTER TABLE "opinion" ADD CONSTRAINT "opinion_estrellas_rango" CHECK ("estrellas" BETWEEN 1 AND 5);

-- Una tienda no se sigue a sí misma.
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_no_a_si_misma" CHECK ("tienda_id" <> "seguida_id");
