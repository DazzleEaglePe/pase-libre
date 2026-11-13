-- docs/19, punto 18: ✓✓ gris en el chat con el Equipo. Hasta cuándo le llegaron los mensajes a
-- la tienda y al Equipo (tenían PaseLibre abierto o lo abrieron después).

-- AlterTable
ALTER TABLE "hilo_equipo" ADD COLUMN "entregado_tienda_hasta" TIMESTAMPTZ(6),
ADD COLUMN "entregado_equipo_hasta" TIMESTAMPTZ(6);
