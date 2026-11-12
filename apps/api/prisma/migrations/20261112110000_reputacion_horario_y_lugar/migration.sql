-- Correcciones 11/11 · perfil (N03, N09): el horario por días de cada tienda, los cambios de
-- galería, piso o stand que esperan al Equipo («Pendiente de aprobación») y «Pedir revisión al
-- Equipo» de una opinión, que se guarda como un reporte más (objeto OPINION).

-- CreateEnum
CREATE TYPE "estado_cambio_lugar" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'RETIRADO');

-- AlterEnum
ALTER TYPE "objeto_denuncia" ADD VALUE 'OPINION';

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "horario_datos" JSONB;

-- CreateTable
CREATE TABLE "cambio_lugar" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "galeria_id" UUID NOT NULL,
    "piso" VARCHAR(20),
    "stand" VARCHAR(20) NOT NULL,
    "estado" "estado_cambio_lugar" NOT NULL DEFAULT 'PENDIENTE',
    "pedido_por_id" UUID NOT NULL,
    "motivo" VARCHAR(300),
    "revisado_por_id" UUID,
    "revisado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambio_lugar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambio_lugar_estado_creado_en_idx" ON "cambio_lugar"("estado", "creado_en");

-- CreateIndex
CREATE INDEX "cambio_lugar_tienda_id_idx" ON "cambio_lugar"("tienda_id");

-- AddForeignKey
ALTER TABLE "cambio_lugar" ADD CONSTRAINT "cambio_lugar_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambio_lugar" ADD CONSTRAINT "cambio_lugar_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galeria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Una sola pendiente por tienda: la nueva reemplaza a la de antes (Prisma no expresa índices parciales).
CREATE UNIQUE INDEX "cambio_lugar_una_pendiente" ON "cambio_lugar"("tienda_id") WHERE "estado" = 'PENDIENTE';

-- Las tiendas que se registraron solas ya eligieron días y horas: se pasan al horario por días.
UPDATE "tienda" t
SET "horario_datos" = jsonb_build_array(s."horario_datos")
FROM "solicitud" s
WHERE s."tienda_id" = t."id"
  AND t."horario_datos" IS NULL
  AND jsonb_typeof(s."horario_datos") = 'object'
  AND s."horario_datos" ? 'dias';
