-- doc 19 §9: suspender al instante (cuándo, quién y por qué) y eliminar una tienda para siempre
-- 24 h después. En los chats, el lado de la tienda eliminada queda nulo: la otra conserva sus
-- mensajes y ve «Tienda eliminada». Las llaves foráneas siguen en RESTRICT: solo el borrado del
-- Equipo deja esos lados en nulo, a mano y dentro de su transacción.

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN "suspendida_en" TIMESTAMPTZ(6),
ADD COLUMN "suspendida_por_id" UUID,
ADD COLUMN "motivo_suspension" VARCHAR(200);

-- Las que ya están suspendidas: desde su última anotación «suspendió a …» del historial del
-- Equipo o, si no hay, desde su último cambio. Las 24 h nunca cuentan desde antes de lo real.
UPDATE "tienda" t
SET "suspendida_en" = coalesce(
  (SELECT max(r."creado_en") FROM "registro_equipo" r
   WHERE r."tienda_id" = t."id" AND r."accion" LIKE 'suspendió a %'),
  t."actualizada_en"
)
WHERE t."estado" = 'SUSPENDIDA' AND t."suspendida_en" IS NULL;

-- AlterTable
ALTER TABLE "conversacion" ALTER COLUMN "oferta_id" DROP NOT NULL,
ALTER COLUMN "comprador_id" DROP NOT NULL,
ALTER COLUMN "vendedor_id" DROP NOT NULL,
ALTER COLUMN "tienda_compradora_id" DROP NOT NULL,
ALTER COLUMN "tienda_vendedora_id" DROP NOT NULL;
