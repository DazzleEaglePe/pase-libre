-- docs/17 §3: subir el ZIP también actualiza los productos que ya estaban.
ALTER TABLE "importacion_catalogo" ADD COLUMN "actualizados" INTEGER NOT NULL DEFAULT 0;
