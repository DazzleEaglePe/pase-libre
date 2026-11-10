-- «Mis ventas y compras» (HI_A2_Web): el precio de cada venta y «Recordarle» que califique.
ALTER TABLE "venta" ADD COLUMN "precio_centimos" BIGINT,
ADD COLUMN "moneda" "moneda",
ADD COLUMN "recordada_en" TIMESTAMPTZ(6);

-- Las ventas de antes: el precio que la oferta tiene hoy es lo más cercano que hay.
UPDATE "venta" v SET "precio_centimos" = o."precio_centimos", "moneda" = o."moneda"
FROM "oferta" o WHERE o."id" = v."oferta_id";
