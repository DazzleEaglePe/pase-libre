-- «Avísame cuando alguien la publique» (EV_WebRes).

-- CreateTable
CREATE TABLE "alerta_busqueda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "texto" VARCHAR(120) NOT NULL,
    "palabras" VARCHAR(120) NOT NULL,
    "avisada_en" TIMESTAMPTZ(6),
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_busqueda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerta_busqueda_usuario_id_palabras_key" ON "alerta_busqueda"("usuario_id", "palabras");

-- AddForeignKey
ALTER TABLE "alerta_busqueda" ADD CONSTRAINT "alerta_busqueda_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

