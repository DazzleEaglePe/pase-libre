-- Reportar con los tres motivos del lienzo final (REP_Web), «Mis reportes» y la cola del equipo.

-- CreateEnum
CREATE TYPE "motivo_denuncia" AS ENUM ('ESTAFA', 'DESCRITO', 'TRATO');

-- AlterEnum
ALTER TYPE "estado_denuncia" ADD VALUE 'EN_REVISION';

-- AlterTable
ALTER TABLE "denuncia" ADD COLUMN     "codigo" SERIAL NOT NULL,
ADD COLUMN     "conversacion_adjunta_id" UUID,
ADD COLUMN     "reservada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolucion" VARCHAR(500),
ADD COLUMN     "resuelta_en" TIMESTAMPTZ(6),
ADD COLUMN     "tienda_denunciada_id" UUID,
ADD COLUMN     "tipo" "motivo_denuncia",
ADD COLUMN     "tomada_en" TIMESTAMPTZ(6),
ALTER COLUMN "motivo" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "denuncia_codigo_key" ON "denuncia"("codigo");

-- CreateIndex
CREATE INDEX "denuncia_denunciante_id_creada_en_idx" ON "denuncia"("denunciante_id", "creada_en" DESC);

-- AddForeignKey
ALTER TABLE "denuncia" ADD CONSTRAINT "denuncia_tienda_denunciada_id_fkey" FOREIGN KEY ("tienda_denunciada_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Los códigos que ve quien reporta empiezan en R-1001.
SELECT setval('denuncia_codigo_seq', GREATEST(1000, (SELECT COALESCE(MAX("codigo"), 0) FROM "denuncia")));

-- La tienda reportada de las denuncias que ya existían.
UPDATE "denuncia" d SET "tienda_denunciada_id" = o."tienda_id"
FROM "oferta" o WHERE d."objeto" = 'OFERTA' AND o."id" = d."objeto_id";
UPDATE "denuncia" d SET "tienda_denunciada_id" = d."objeto_id"
WHERE d."objeto" = 'TIENDA' AND EXISTS (SELECT 1 FROM "tienda" t WHERE t."id" = d."objeto_id");
UPDATE "denuncia" d SET "tienda_denunciada_id" = e."tienda_id"
FROM "en_vivo" e WHERE d."objeto" = 'EN_VIVO' AND e."id" = d."objeto_id";
