-- doc 20, A1 (campanita): «llegó» deja de depender de `actualizado_en`, que es @updatedAt y lo
-- mueve cualquier cambio (editar o borrar un mensaje, pasar el chat a otra persona del Equipo).
-- `llegado_en` solo cambia cuando el aviso se crea o trae otro mensaje. Los avisos de antes
-- toman su `actualizado_en`, para no cambiar el número de nadie al subir.

-- AlterTable
ALTER TABLE "aviso" ADD COLUMN "llegado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
UPDATE "aviso" SET "llegado_en" = "actualizado_en";

-- CreateIndex
CREATE INDEX "aviso_usuario_id_llegado_en_idx" ON "aviso"("usuario_id", "llegado_en");
