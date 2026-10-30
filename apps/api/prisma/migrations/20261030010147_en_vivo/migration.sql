-- CreateEnum
CREATE TYPE "tipo_en_vivo" AS ENUM ('BUSCO', 'FLASH');

-- CreateEnum
CREATE TYPE "estado_en_vivo" AS ENUM ('VIVO', 'CONSEGUIDO', 'VENDIDO', 'CERRADO');

-- AlterEnum
ALTER TYPE "objeto_denuncia" ADD VALUE 'EN_VIVO';

-- AlterEnum
ALTER TYPE "tipo_aviso" ADD VALUE 'EN_VIVO';

-- AlterTable
ALTER TABLE "conversacion" ADD COLUMN     "en_vivo_id" UUID;

-- CreateTable
CREATE TABLE "en_vivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_en_vivo" NOT NULL,
    "autor_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "galeria_id" UUID,
    "categoria_id" UUID NOT NULL,
    "producto_id" UUID,
    "oferta_id" UUID,
    "titulo" VARCHAR(200) NOT NULL,
    "cantidad" SMALLINT NOT NULL DEFAULT 1,
    "vendidas" SMALLINT NOT NULL DEFAULT 0,
    "condicion" "condicion",
    "precio_centimos" BIGINT,
    "moneda" "moneda" NOT NULL DEFAULT 'USD',
    "nota" VARCHAR(120),
    "avisadas" SMALLINT NOT NULL DEFAULT 0,
    "vence_en" TIMESTAMPTZ(6) NOT NULL,
    "estado" "estado_en_vivo" NOT NULL DEFAULT 'VIVO',
    "cerrado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "en_vivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "en_vivo_respuesta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "en_vivo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "oferta_id" UUID,
    "conversacion_id" UUID NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "en_vivo_respuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "en_vivo_estado_vence_en_idx" ON "en_vivo"("estado", "vence_en");

-- CreateIndex
CREATE INDEX "en_vivo_autor_id_estado_idx" ON "en_vivo"("autor_id", "estado");

-- CreateIndex
CREATE INDEX "en_vivo_respuesta_conversacion_id_idx" ON "en_vivo_respuesta"("conversacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "en_vivo_respuesta_en_vivo_id_tienda_id_key" ON "en_vivo_respuesta"("en_vivo_id", "tienda_id");

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_en_vivo_id_fkey" FOREIGN KEY ("en_vivo_id") REFERENCES "en_vivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galeria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo_respuesta" ADD CONSTRAINT "en_vivo_respuesta_en_vivo_id_fkey" FOREIGN KEY ("en_vivo_id") REFERENCES "en_vivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo_respuesta" ADD CONSTRAINT "en_vivo_respuesta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo_respuesta" ADD CONSTRAINT "en_vivo_respuesta_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo_respuesta" ADD CONSTRAINT "en_vivo_respuesta_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "en_vivo_respuesta" ADD CONSTRAINT "en_vivo_respuesta_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reglas que Prisma no expresa (docs/06 §6, D-53).

-- La oferta flash sale de una publicación y lleva su precio de pase.
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_flash_completa" CHECK (
  "tipo" <> 'FLASH'
  OR ("precio_centimos" IS NOT NULL AND "oferta_id" IS NOT NULL AND "producto_id" IS NOT NULL)
);
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_cantidades" CHECK ("cantidad" >= 0 AND "vendidas" >= 0 AND "avisadas" >= 0);
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_precio_positivo" CHECK ("precio_centimos" IS NULL OR "precio_centimos" > 0);
-- Dura unas horas: nunca más de 12 desde que se publicó, aunque se sumen horas.
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_duracion" CHECK (
  "vence_en" > "creado_en" AND "vence_en" <= "creado_en" + interval '12 hours'
);
-- Cerrar deja la hora; mientras está en vivo no la tiene.
ALTER TABLE "en_vivo" ADD CONSTRAINT "en_vivo_cierre" CHECK (("estado" = 'VIVO') = ("cerrado_en" IS NULL));
