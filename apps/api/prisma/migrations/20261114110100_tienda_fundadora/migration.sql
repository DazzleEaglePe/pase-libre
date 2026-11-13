-- doc 20, punto 7: «Piloto» pasa a «Tiendas fundadoras» (máximo 10, lo cuida la API).
-- `fundadora_desde` nulo = no es fundadora. `fundadora_dia`: 1 = lunes … 6 = sábado.

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN "fundadora_desde" TIMESTAMPTZ(6),
ADD COLUMN "fundadora_dia" SMALLINT,
ADD COLUMN "fundadora_sello" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fundadora_prioridad" BOOLEAN NOT NULL DEFAULT true;

-- El día va de lunes (1) a sábado (6).
ALTER TABLE "tienda" ADD CONSTRAINT "tienda_fundadora_dia_check"
  CHECK ("fundadora_dia" IS NULL OR "fundadora_dia" BETWEEN 1 AND 6);
