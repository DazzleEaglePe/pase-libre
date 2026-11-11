-- Panel del equipo del lienzo final: el modo oscuro en la cuenta (COR18), «Destacar en
-- silencio» (COR16) y los archivos del catálogo que se revisan antes de guardar (COR15).

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "tema_oscuro" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "destacado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "por_id" UUID NOT NULL,
    "ofertas" UUID[],
    "desde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMPTZ(6) NOT NULL,
    "avisada" BOOLEAN NOT NULL DEFAULT false,
    "quitado_en" TIMESTAMPTZ(6),

    CONSTRAINT "destacado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacion_catalogo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "filas" JSONB NOT NULL,
    "fotos" JSONB NOT NULL DEFAULT '{}',
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicada_en" TIMESTAMPTZ(6),
    "creados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "importacion_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "destacado_hasta_idx" ON "destacado"("hasta");

-- CreateIndex
CREATE INDEX "destacado_tienda_id_idx" ON "destacado"("tienda_id");

-- AddForeignKey
ALTER TABLE "destacado" ADD CONSTRAINT "destacado_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destacado" ADD CONSTRAINT "destacado_por_id_fkey" FOREIGN KEY ("por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion_catalogo" ADD CONSTRAINT "importacion_catalogo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

