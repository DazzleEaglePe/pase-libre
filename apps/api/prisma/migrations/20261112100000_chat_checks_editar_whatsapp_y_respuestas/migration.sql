-- Chat de las correcciones 11/11 (N01, N02, N11): checks como WhatsApp («le llegó»), editar y
-- eliminar dentro de 15 minutos con lo de antes guardado para el Equipo, «Responder», pedir y
-- compartir el WhatsApp de la tienda, y las respuestas rápidas por papel («Cuando te escriben»
-- y «Cuando tú preguntas»).

-- CreateEnum
CREATE TYPE "estado_pedido_whatsapp" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "cambio_mensaje" AS ENUM ('EDITADO', 'ELIMINADO');

-- CreateEnum
CREATE TYPE "papel_respuesta" AS ENUM ('VENDEDOR', 'COMPRADOR');

-- AlterEnum (el valor nuevo no se usa en esta misma migración)
ALTER TYPE "tipo_mensaje" ADD VALUE 'PEDIDO_WHATSAPP';
ALTER TYPE "tipo_mensaje" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "mensaje" ADD COLUMN     "editado_en" TIMESTAMPTZ(6),
ADD COLUMN     "eliminado_en" TIMESTAMPTZ(6),
ADD COLUMN     "oculto_para" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "pedido_estado" "estado_pedido_whatsapp",
ADD COLUMN     "responde_a_id" UUID,
ADD COLUMN     "whatsapp" VARCHAR(20);

-- AlterTable
ALTER TABLE "participacion" ADD COLUMN     "recibido_hasta" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "respuesta_rapida" ADD COLUMN     "papel" "papel_respuesta" NOT NULL DEFAULT 'VENDEDOR';

-- Lo que debe tener cada mensaje: un eliminado ya no tiene texto ni foto, un pedido tiene su
-- estado y uno de WhatsApp, el número. Se compara como texto: los valores nuevos del tipo no
-- se pueden usar en la misma transacción que los agrega.
ALTER TABLE "mensaje" DROP CONSTRAINT "mensaje_contenido_check";
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_contenido_check"
  CHECK (
    "eliminado_en" IS NOT NULL
    OR ("tipo"::text = 'FOTO' AND "foto" IS NOT NULL)
    OR ("tipo"::text = 'PEDIDO_WHATSAPP' AND "pedido_estado" IS NOT NULL)
    OR ("tipo"::text = 'WHATSAPP' AND "whatsapp" IS NOT NULL)
    OR ("tipo"::text IN ('TEXTO', 'SISTEMA') AND "texto" IS NOT NULL)
  );

-- CreateTable
CREATE TABLE "mensaje_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mensaje_id" UUID NOT NULL,
    "cambio" "cambio_mensaje" NOT NULL,
    "texto" VARCHAR(2000),
    "foto" VARCHAR(300),
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensaje_version_mensaje_id_creada_en_idx" ON "mensaje_version"("mensaje_id", "creada_en");

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_responde_a_id_fkey" FOREIGN KEY ("responde_a_id") REFERENCES "mensaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje_version" ADD CONSTRAINT "mensaje_version_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "mensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Las respuestas rápidas que ya había: las de quien pregunta pasan a «Cuando tú preguntas».
-- Quien nunca cambió las cuatro de siempre recibe las nuevas del lienzo, cuatro de cada papel.
CREATE TEMP TABLE sin_cambios ON COMMIT DROP AS
SELECT usuario_id FROM "respuesta_rapida"
GROUP BY usuario_id
HAVING count(*) = 4
   AND bool_and(texto IN ('¿Sigue disponible?', 'Te lo separo', 'Paso a recoger', 'Ya no tengo'));

DELETE FROM "respuesta_rapida" WHERE usuario_id IN (SELECT usuario_id FROM sin_cambios);

INSERT INTO "respuesta_rapida" (usuario_id, texto, orden, papel)
SELECT s.usuario_id, r.texto, r.orden, r.papel::"papel_respuesta"
FROM sin_cambios s
CROSS JOIN (VALUES
  ('Hola, {tienda}, ¿qué tal? 👋', 0, 'VENDEDOR'),
  ('Déjame revisar el stock y en breve te confirmo.', 1, 'VENDEDOR'),
  ('Te lo separo', 2, 'VENDEDOR'),
  ('Ahora no lo tengo, pero te aviso si me llega.', 3, 'VENDEDOR'),
  ('¿Sigue disponible?', 0, 'COMPRADOR'),
  ('¿Me lo separas?', 1, 'COMPRADOR'),
  ('Paso a recoger', 2, 'COMPRADOR'),
  ('¿Cuál es tu mejor precio?', 3, 'COMPRADOR')
) AS r(texto, orden, papel);

UPDATE "respuesta_rapida" SET papel = 'COMPRADOR'
WHERE usuario_id NOT IN (SELECT usuario_id FROM sin_cambios)
  AND texto IN ('¿Sigue disponible?', 'Paso a recoger', '¿Me lo separas?', '¿Cuál es tu mejor precio?');
