-- docs/19, punto 17: «¿Lograste cerrar el trato?». Se guarda por conversación, así vale en todos
-- los equipos de quien vende: «Todavía no» la esconde 24 h y la X, para siempre.

-- AlterTable
ALTER TABLE "conversacion" ADD COLUMN "trato_pospuesto_en" TIMESTAMPTZ(6),
ADD COLUMN "trato_descartado_en" TIMESTAMPTZ(6);
