-- CreateTable
CREATE TABLE "archivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tienda_id" UUID,
    "ruta" VARCHAR(300) NOT NULL,
    "ancho" INTEGER NOT NULL,
    "alto" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "usado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archivo_ruta_key" ON "archivo"("ruta");

-- CreateIndex
CREATE INDEX "archivo_usuario_id_creado_en_idx" ON "archivo"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "archivo_tienda_id_idx" ON "archivo"("tienda_id");

-- AddForeignKey
ALTER TABLE "archivo" ADD CONSTRAINT "archivo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivo" ADD CONSTRAINT "archivo_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
