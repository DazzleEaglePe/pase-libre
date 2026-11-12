-- Feed de las correcciones 11/11 (N16, N07, N06):
-- · `tienda.inicio_normal_en`: cuándo el inicio de la tienda llegó a 12 publicaciones de otras
--   tiendas. Desde ahí es el inicio normal y ya no vuelve atrás (lo decide el servidor).
-- · `usuario.invitar_cerrado_en`: tocó la X del banner «¿Conoces una tienda…?»; se guarda en la
--   cuenta para que no vuelva a salir en ningún dispositivo.
-- · `usuario.recien_visto_en`: la última vez que entró a «Recién llegados», para el «+N nuevo».
-- · `oferta.negociable`: «Precio fijo ▾ / Negociable» del campo de precio (la burbujita).

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "negociable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "inicio_normal_en" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "invitar_cerrado_en" TIMESTAMPTZ(6),
ADD COLUMN     "recien_visto_en" TIMESTAMPTZ(6);
