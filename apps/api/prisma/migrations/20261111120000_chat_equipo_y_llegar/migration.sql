-- «Cómo llegar» de cada tienda y el chat oficial con el equipo (sección 13 del lienzo final).

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "indicaciones" VARCHAR(240);

-- CreateTable
CREATE TABLE "hilo_equipo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "ultimo_mensaje_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido_tienda_hasta" TIMESTAMPTZ(6),
    "leido_equipo_hasta" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hilo_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensaje_equipo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hilo_id" UUID NOT NULL,
    "autor_id" UUID NOT NULL,
    "de_equipo" BOOLEAN NOT NULL,
    "texto" VARCHAR(2000) NOT NULL,
    "denuncia_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hilo_equipo_tienda_id_key" ON "hilo_equipo"("tienda_id");

-- CreateIndex
CREATE INDEX "hilo_equipo_ultimo_mensaje_en_idx" ON "hilo_equipo"("ultimo_mensaje_en");

-- CreateIndex
CREATE INDEX "mensaje_equipo_hilo_id_creado_en_idx" ON "mensaje_equipo"("hilo_id", "creado_en");

-- AddForeignKey
ALTER TABLE "hilo_equipo" ADD CONSTRAINT "hilo_equipo_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_equipo" ADD CONSTRAINT "mensaje_equipo_hilo_id_fkey" FOREIGN KEY ("hilo_id") REFERENCES "hilo_equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_equipo" ADD CONSTRAINT "mensaje_equipo_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_equipo" ADD CONSTRAINT "mensaje_equipo_denuncia_id_fkey" FOREIGN KEY ("denuncia_id") REFERENCES "denuncia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

