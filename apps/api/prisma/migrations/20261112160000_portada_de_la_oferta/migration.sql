-- La tienda elige la foto de portada de su publicación (docs/17 §5).
-- · `oferta.portada_ruta`: la ruta de una de sus fotos (`oferta_foto`). Nula = la de siempre: la
--   primera del producto (del catálogo) o, si el producto no tiene, la primera de la tienda. La API
--   solo acepta rutas de las fotos de esa oferta, y la vuelve a nula si la tienda quita esa foto.

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "portada_ruta" VARCHAR(300);
