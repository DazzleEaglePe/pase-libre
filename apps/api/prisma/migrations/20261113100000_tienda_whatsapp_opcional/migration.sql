-- doc 19, punto 6: el Equipo crea la cuenta sin WhatsApp y lo completa después. Las tiendas
-- que ya lo tienen no cambian; en Cuentas, las que no lo tienen salen con «Falta WhatsApp».

-- AlterTable
ALTER TABLE "tienda" ALTER COLUMN "whatsapp" DROP NOT NULL;
