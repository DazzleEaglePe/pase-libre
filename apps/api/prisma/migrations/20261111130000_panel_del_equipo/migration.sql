-- Panel del equipo: advertencias, comunicados y lo último del equipo (sección 20 del lienzo final).

-- CreateTable
CREATE TABLE "advertencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "denuncia_id" UUID,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "autor_id" UUID NOT NULL,
    "para" VARCHAR(80) NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "texto" VARCHAR(600) NOT NULL,
    "enviados" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_equipo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "autor_id" UUID NOT NULL,
    "accion" VARCHAR(240) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "advertencia_tienda_id_creada_en_idx" ON "advertencia"("tienda_id", "creada_en");

-- CreateIndex
CREATE INDEX "comunicado_creado_en_idx" ON "comunicado"("creado_en");

-- CreateIndex
CREATE INDEX "registro_equipo_creado_en_idx" ON "registro_equipo"("creado_en");

-- AddForeignKey
ALTER TABLE "advertencia" ADD CONSTRAINT "advertencia_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertencia" ADD CONSTRAINT "advertencia_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertencia" ADD CONSTRAINT "advertencia_denuncia_id_fkey" FOREIGN KEY ("denuncia_id") REFERENCES "denuncia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado" ADD CONSTRAINT "comunicado_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_equipo" ADD CONSTRAINT "registro_equipo_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

