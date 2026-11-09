-- CreateEnum
CREATE TYPE "estado_solicitud" AS ENUM ('PENDIENTE', 'REQUIERE_CAMBIOS', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "metodo_solicitud" AS ENUM ('RUC', 'SIN_RUC_DNI', 'SIN_RUC_RECOMENDACION', 'SIN_RUC_CREDENCIAL');

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "piso" VARCHAR(20);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consulta_hash" CHAR(64) NOT NULL,
    "celular" VARCHAR(9) NOT NULL,
    "celular_verificado_en" TIMESTAMPTZ(6) NOT NULL,
    "metodo" "metodo_solicitud" NOT NULL,
    "ruc" VARCHAR(11),
    "ruc_datos" JSONB,
    "dni" VARCHAR(8),
    "recomienda_tienda" VARCHAR(120),
    "nombre_comercial" VARCHAR(120) NOT NULL,
    "categorias" TEXT[],
    "galeria_id" UUID,
    "galeria_otra" VARCHAR(120),
    "piso" VARCHAR(20),
    "stand" VARCHAR(20) NOT NULL,
    "referencia" VARCHAR(200),
    "horario" VARCHAR(120) NOT NULL,
    "horario_datos" JSONB NOT NULL,
    "encargado" VARCHAR(120) NOT NULL,
    "clave_hash" VARCHAR(255) NOT NULL,
    "acepto_terminos_en" TIMESTAMPTZ(6) NOT NULL,
    "estado" "estado_solicitud" NOT NULL DEFAULT 'PENDIENTE',
    "aprobada_sola" BOOLEAN NOT NULL DEFAULT false,
    "mensaje_equipo" VARCHAR(500),
    "vence_en" TIMESTAMPTZ(6),
    "revisada_por_id" UUID,
    "revisada_en" TIMESTAMPTZ(6),
    "tienda_id" UUID,
    "usuario_id" UUID,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_celular" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "celular" VARCHAR(9) NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "verificado_en" TIMESTAMPTZ(6),
    "token_hash" CHAR(64),
    "token_expira_en" TIMESTAMPTZ(6),
    "consumido_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_celular_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_consulta_hash_key" ON "solicitud"("consulta_hash");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_tienda_id_key" ON "solicitud"("tienda_id");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_usuario_id_key" ON "solicitud"("usuario_id");

-- CreateIndex
CREATE INDEX "solicitud_estado_creada_en_idx" ON "solicitud"("estado", "creada_en");

-- CreateIndex
CREATE INDEX "solicitud_celular_idx" ON "solicitud"("celular");

-- CreateIndex
CREATE UNIQUE INDEX "codigo_celular_token_hash_key" ON "codigo_celular"("token_hash");

-- CreateIndex
CREATE INDEX "codigo_celular_celular_creado_en_idx" ON "codigo_celular"("celular", "creado_en");

