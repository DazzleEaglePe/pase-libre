-- «Solicitar seguir» a un perfil privado (doc 20, punto 5) y su aviso en la campanita.

-- AlterEnum
ALTER TYPE "tipo_aviso" ADD VALUE IF NOT EXISTS 'SOLICITUD_SEGUIR';

-- CreateTable
CREATE TABLE "solicitud_seguir" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "seguida_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_seguir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_seguir_seguida_id_creada_en_idx" ON "solicitud_seguir"("seguida_id", "creada_en");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_seguir_tienda_id_seguida_id_key" ON "solicitud_seguir"("tienda_id", "seguida_id");

-- AddForeignKey
ALTER TABLE "solicitud_seguir" ADD CONSTRAINT "solicitud_seguir_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_seguir" ADD CONSTRAINT "solicitud_seguir_seguida_id_fkey" FOREIGN KEY ("seguida_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_seguir" ADD CONSTRAINT "solicitud_seguir_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una tienda que se sigue a sí misma no tiene sentido.
ALTER TABLE "solicitud_seguir" ADD CONSTRAINT "solicitud_seguir_otra_tienda" CHECK ("tienda_id" <> "seguida_id");
