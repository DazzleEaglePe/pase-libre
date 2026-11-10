-- Publicar como el lienzo final (PUB_WebProducto) y precio socio (PS_Precio, PS_SociosWeb).

-- CreateEnum
CREATE TYPE "estado_detalle" AS ENUM ('SELLADO', 'OPEN_BOX', 'USADO', 'REACONDICIONADO');

-- CreateEnum
CREATE TYPE "garantia" AS ENUM ('SIN', 'UN_MES', 'TRES_MESES', 'SEIS_MESES', 'UN_ANIO', 'FABRICA');

-- CreateEnum
CREATE TYPE "modo_venta" AS ENUM ('PASE', 'FACTURADO', 'AMBOS');

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "acepta_ofertas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "con_caja" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "con_factura" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "descuento_socio_centimos" BIGINT,
ADD COLUMN     "en_almacen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estado_detalle" "estado_detalle",
ADD COLUMN     "garantia" "garantia",
ADD COLUMN     "modo_venta" "modo_venta" NOT NULL DEFAULT 'PASE',
ADD COLUMN     "precio_facturado_centimos" BIGINT,
ADD COLUMN     "probado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "solo_socios" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "socio" (
    "tienda_id" UUID NOT NULL,
    "socio_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "socio_pkey" PRIMARY KEY ("tienda_id","socio_id")
);

-- CreateIndex
CREATE INDEX "socio_socio_id_idx" ON "socio"("socio_id");

-- AddForeignKey
ALTER TABLE "socio" ADD CONSTRAINT "socio_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socio" ADD CONSTRAINT "socio_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lo publicado antes: nuevo es «Nuevo sellado» y usado, «Usado».
UPDATE "oferta" SET "estado_detalle" = CASE "condicion" WHEN 'NUEVO' THEN 'SELLADO'::"estado_detalle" ELSE 'USADO'::"estado_detalle" END;

-- Una tienda no es socia de sí misma; el descuento y el precio facturado no son negativos.
ALTER TABLE "socio" ADD CONSTRAINT "socio_no_a_si_misma" CHECK ("tienda_id" <> "socio_id");
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_descuento_socio_positivo" CHECK ("descuento_socio_centimos" IS NULL OR "descuento_socio_centimos" > 0);
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_precio_facturado_positivo" CHECK ("precio_facturado_centimos" IS NULL OR "precio_facturado_centimos" > 0);
