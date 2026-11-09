-- AlterTable
ALTER TABLE "bloqueo" ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "reservada" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "bloqueo_id_key" ON "bloqueo"("id");
