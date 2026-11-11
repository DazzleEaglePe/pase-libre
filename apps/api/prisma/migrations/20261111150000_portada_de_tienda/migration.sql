-- La portada del perfil de la tienda (COR1 del lienzo final): la foto, su tamaño y qué parte
-- se ve («Acomodar»). Sin foto, la web arma la portada automática.

-- AlterTable
ALTER TABLE "tienda" ADD COLUMN     "portada_alto" INTEGER,
ADD COLUMN     "portada_ancho" INTEGER,
ADD COLUMN     "portada_posicion" SMALLINT NOT NULL DEFAULT 50,
ADD COLUMN     "portada_ruta" VARCHAR(300);

