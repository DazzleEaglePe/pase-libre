-- Al publicar: para qué procesador es y el empaque (docs/19 §13).
-- · `oferta.perfil_memoria`: «¿Para qué procesador es?» de una memoria RAM (Intel XMP, EXPO Ryzen
--   o los dos). Nulo si no se marcó.
-- · `oferta.empaque`: «Con caja» u «OEM · sin caja» (Box o Tray en los procesadores).
-- · `oferta.oc`: tarjetas de video OC (verdadero) o normales (falso).
-- · `producto.perfil_memoria`: lo que dice el catálogo (columna «Perfil de memoria» de la
--   plantilla); con él, la pregunta viene marcada al publicar.

-- CreateEnum
CREATE TYPE "perfil_memoria" AS ENUM ('XMP', 'EXPO', 'AMBOS');

-- CreateEnum
CREATE TYPE "empaque" AS ENUM ('CAJA', 'OEM');

-- AlterTable
ALTER TABLE "oferta" ADD COLUMN     "empaque" "empaque",
ADD COLUMN     "oc" BOOLEAN,
ADD COLUMN     "perfil_memoria" "perfil_memoria";

-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "perfil_memoria" "perfil_memoria";
