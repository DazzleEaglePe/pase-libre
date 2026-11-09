-- «Tienda reservada» (lienzo «Demo · lo aprobado»): cada oferta decide si muestra el nombre de su tienda.
ALTER TABLE "oferta" ADD COLUMN "tienda_visible" BOOLEAN NOT NULL DEFAULT true;
