-- Correcciones 11/11, área C (tableros N10, N12 y N14):
-- · Máximo de dispositivos de la cuenta principal por tienda (`tienda.limite_dispositivos`, 2;
--   el equipo lo sube a pedido).
-- · Asesores con permisos por persona (`usuario.permisos`), pausados o quitados por el dueño.
--   Los asesores que ya existían podían todo (docs/05 §9): se les dan todos los permisos para
--   no quitarles nada de golpe; los nuevos vienen con comprar y vender, marcar vendido y en vivo.
-- · «Ayudar como la tienda» (`modo_soporte`, y `sesion.soporte_id` mientras dura).
-- · La respuesta automática del chat del equipo (`mensaje_equipo.automatica`, sin autor) y
--   dónde se edita (`ajuste_equipo`).
-- · «Historial de cambios» de cada tienda en el panel (`registro_equipo.tienda_id`).

-- CreateEnum
CREATE TYPE "permiso_asesor" AS ENUM ('COMPRAR_VENDER', 'MARCAR_VENDIDO', 'EN_VIVO', 'PUBLICAR', 'DATOS_TIENDA', 'HISTORIAL');

-- DropForeignKey
ALTER TABLE "mensaje_equipo" DROP CONSTRAINT "mensaje_equipo_autor_id_fkey";

-- AlterTable
ALTER TABLE "mensaje_equipo" ADD COLUMN     "automatica" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "autor_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "registro_equipo" ADD COLUMN     "tienda_id" UUID;

-- AlterTable
ALTER TABLE "sesion" ADD COLUMN     "soporte_id" UUID;

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "limite_dispositivos" SMALLINT NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "pausado_en" TIMESTAMPTZ(6),
ADD COLUMN     "permisos" "permiso_asesor"[] DEFAULT ARRAY['COMPRAR_VENDER', 'MARCAR_VENDIDO', 'EN_VIVO']::"permiso_asesor"[],
ADD COLUMN     "quitado_en" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "modo_soporte" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "pedido_por_id" UUID,
    "pedido_en" TIMESTAMPTZ(6),
    "equipo_id" UUID,
    "iniciado_en" TIMESTAMPTZ(6),
    "vence_en" TIMESTAMPTZ(6),
    "terminado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modo_soporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajuste_equipo" (
    "clave" VARCHAR(60) NOT NULL,
    "valor" VARCHAR(2000) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_por_id" UUID,

    CONSTRAINT "ajuste_equipo_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "modo_soporte_tienda_id_creado_en_idx" ON "modo_soporte"("tienda_id", "creado_en");

-- CreateIndex
CREATE INDEX "registro_equipo_tienda_id_creado_en_idx" ON "registro_equipo"("tienda_id", "creado_en");

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_soporte_id_fkey" FOREIGN KEY ("soporte_id") REFERENCES "modo_soporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_equipo" ADD CONSTRAINT "mensaje_equipo_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_equipo" ADD CONSTRAINT "registro_equipo_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modo_soporte" ADD CONSTRAINT "modo_soporte_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modo_soporte" ADD CONSTRAINT "modo_soporte_pedido_por_id_fkey" FOREIGN KEY ("pedido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modo_soporte" ADD CONSTRAINT "modo_soporte_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los asesores de antes conservan lo que ya podían hacer.
UPDATE "usuario" SET "permisos" = ARRAY['COMPRAR_VENDER', 'MARCAR_VENDIDO', 'EN_VIVO', 'PUBLICAR', 'DATOS_TIENDA', 'HISTORIAL']::"permiso_asesor"[]
WHERE "rol" = 'ASESOR';
