-- «Descuento por defecto» de los socios (PS_SociosWeb): se pone solo al publicar.
ALTER TABLE "tienda" ADD COLUMN "descuento_socio_pen" BIGINT,
ADD COLUMN "descuento_socio_usd" BIGINT;
ALTER TABLE "tienda" ADD CONSTRAINT "tienda_descuento_socio_positivo"
  CHECK (("descuento_socio_pen" IS NULL OR "descuento_socio_pen" > 0)
     AND ("descuento_socio_usd" IS NULL OR "descuento_socio_usd" > 0));
