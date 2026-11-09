-- CreateIndex
CREATE INDEX "oferta_estado_actualizada_en_idx" ON "oferta"("estado", "actualizada_en");

-- CreateIndex
CREATE INDEX "conversacion_tienda_vendedora_id_creada_en_idx" ON "conversacion"("tienda_vendedora_id", "creada_en");

-- CreateIndex
CREATE INDEX "aviso_usuario_id_actualizado_en_idx" ON "aviso"("usuario_id", "actualizado_en");

-- CreateIndex
CREATE INDEX "en_vivo_cerrado_en_idx" ON "en_vivo"("cerrado_en");
