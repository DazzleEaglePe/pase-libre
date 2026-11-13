-- docs/19, punto 16: los avisos del chat con el Equipo se agrupan por hilo, como los de los
-- chats entre tiendas. Un aviso por persona y por hilo, que se actualiza y sube arriba.

-- AlterTable
ALTER TABLE "aviso" ADD COLUMN "hilo_equipo_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "aviso_usuario_id_hilo_equipo_id_key" ON "aviso"("usuario_id", "hilo_equipo_id");

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_hilo_equipo_id_fkey" FOREIGN KEY ("hilo_equipo_id") REFERENCES "hilo_equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
