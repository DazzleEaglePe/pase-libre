-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('DUENO', 'ASESOR', 'EQUIPO');

-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "tipo_tienda" AS ENUM ('TIENDA', 'INDEPENDIENTE');

-- CreateEnum
CREATE TYPE "estado_tienda" AS ENUM ('ACTIVA', 'SUSPENDIDA');

-- CreateEnum
CREATE TYPE "moneda" AS ENUM ('USD', 'PEN');

-- CreateEnum
CREATE TYPE "condicion" AS ENUM ('NUEVO', 'USADO');

-- CreateEnum
CREATE TYPE "estado_oferta" AS ENUM ('ACTIVA', 'PAUSADA', 'ELIMINADA');

-- CreateEnum
CREATE TYPE "tipo_mensaje" AS ENUM ('TEXTO', 'FOTO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "tipo_aviso" AS ENUM ('MENSAJE', 'SEGURIDAD', 'RECORDATORIO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "objeto_denuncia" AS ENUM ('OFERTA', 'CONVERSACION', 'TIENDA');

-- CreateEnum
CREATE TYPE "estado_denuncia" AS ENUM ('ABIERTA', 'REVISADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "canal_contacto" AS ENUM ('CHAT', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "estado_carga" AS ENUM ('BORRADOR', 'CARGADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "galeria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(80) NOT NULL,
    "slug" CITEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tienda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_tienda" NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "galeria_id" UUID,
    "stand" VARCHAR(20),
    "whatsapp" VARCHAR(20) NOT NULL,
    "horario" VARCHAR(120),
    "descripcion" VARCHAR(500),
    "logo" VARCHAR(300),
    "precio_visible_defecto" BOOLEAN NOT NULL DEFAULT false,
    "moneda_defecto" "moneda" NOT NULL DEFAULT 'USD',
    "perfil_privado" BOOLEAN NOT NULL DEFAULT false,
    "estado" "estado_tienda" NOT NULL DEFAULT 'ACTIVA',
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID,
    "rol" "rol" NOT NULL,
    "usuario" CITEXT NOT NULL,
    "correo" CITEXT,
    "nombre" VARCHAR(120) NOT NULL,
    "whatsapp" VARCHAR(20),
    "clave_hash" VARCHAR(255) NOT NULL,
    "debe_cambiar_clave" BOOLEAN NOT NULL DEFAULT true,
    "primer_ingreso_en" TIMESTAMPTZ(6),
    "estado" "estado_usuario" NOT NULL DEFAULT 'ACTIVO',
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "intentos_desde" TIMESTAMPTZ(6),
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "ultimo_ingreso_en" TIMESTAMPTZ(6),
    "no_molestar_desde" SMALLINT,
    "no_molestar_hasta" SMALLINT,
    "mostrar_visto" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "recordar" BOOLEAN NOT NULL DEFAULT false,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocada_en" TIMESTAMPTZ(6),
    "agente" VARCHAR(300),
    "ip" VARCHAR(45),

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(80) NOT NULL,
    "slug" CITEXT NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "padre_id" UUID,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" CITEXT NOT NULL,
    "slug" CITEXT NOT NULL,

    CONSTRAINT "marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoria_id" UUID NOT NULL,
    "marca_id" UUID,
    "titulo" VARCHAR(200) NOT NULL,
    "modelo" VARCHAR(120),
    "slug" CITEXT NOT NULL,
    "caracteristicas" JSONB NOT NULL DEFAULT '{}',
    "texto_busqueda" TEXT NOT NULL DEFAULT '',
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_tienda_id" UUID,
    "fusionado_en_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_foto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producto_id" UUID NOT NULL,
    "ruta" VARCHAR(300) NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "ancho" INTEGER,
    "alto" INTEGER,

    CONSTRAINT "producto_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiqueta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(60) NOT NULL,
    "clave" CITEXT NOT NULL,

    CONSTRAINT "etiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_etiqueta" (
    "producto_id" UUID NOT NULL,
    "etiqueta_id" UUID NOT NULL,

    CONSTRAINT "producto_etiqueta_pkey" PRIMARY KEY ("producto_id","etiqueta_id")
);

-- CreateTable
CREATE TABLE "oferta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "producto_id" UUID NOT NULL,
    "tienda_id" UUID NOT NULL,
    "responsable_id" UUID NOT NULL,
    "condicion" "condicion" NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 1,
    "precio_centimos" BIGINT,
    "moneda" "moneda" NOT NULL DEFAULT 'USD',
    "precio_visible" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" VARCHAR(500),
    "estado" "estado_oferta" NOT NULL DEFAULT 'ACTIVA',
    "vigente" BOOLEAN DEFAULT true,
    "actualizada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta_foto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oferta_id" UUID NOT NULL,
    "ruta" VARCHAR(300) NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "oferta_foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "termino" (
    "palabra" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "termino_pkey" PRIMARY KEY ("palabra")
);

-- CreateTable
CREATE TABLE "conversacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oferta_id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "vendedor_id" UUID NOT NULL,
    "tienda_compradora_id" UUID NOT NULL,
    "tienda_vendedora_id" UUID NOT NULL,
    "ultimo_mensaje_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacion" (
    "conversacion_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "silenciada" BOOLEAN NOT NULL DEFAULT false,
    "no_leida_manual" BOOLEAN NOT NULL DEFAULT false,
    "leido_hasta" TIMESTAMPTZ(6),

    CONSTRAINT "participacion_pkey" PRIMARY KEY ("conversacion_id","usuario_id")
);

-- CreateTable
CREATE TABLE "mensaje" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversacion_id" UUID NOT NULL,
    "autor_id" UUID,
    "tipo" "tipo_mensaje" NOT NULL,
    "texto" VARCHAR(2000),
    "foto" VARCHAR(300),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuesta_rapida" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "texto" VARCHAR(120) NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "respuesta_rapida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueo" (
    "usuario_id" UUID NOT NULL,
    "tienda_bloqueada_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueo_pkey" PRIMARY KEY ("usuario_id","tienda_bloqueada_id")
);

-- CreateTable
CREATE TABLE "denuncia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "denunciante_id" UUID NOT NULL,
    "objeto" "objeto_denuncia" NOT NULL,
    "objeto_id" UUID NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "estado" "estado_denuncia" NOT NULL DEFAULT 'ABIERTA',
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oferta_id" UUID NOT NULL,
    "comprador_id" UUID,
    "tienda_compradora_id" UUID,
    "conversacion_id" UUID,
    "stock_antes" INTEGER NOT NULL,
    "stock_despues" INTEGER NOT NULL,
    "registrada_por_id" UUID NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_aviso" NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "extracto" VARCHAR(240),
    "enlace" VARCHAR(300),
    "conversacion_id" UUID,
    "visible_desde" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferencia_aviso" (
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_aviso" NOT NULL,
    "campanita" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "preferencia_aviso_pkey" PRIMARY KEY ("usuario_id","tipo")
);

-- CreateTable
CREATE TABLE "busqueda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "texto" VARCHAR(200) NOT NULL,
    "texto_corregido" VARCHAR(200),
    "resultados" INTEGER NOT NULL,
    "usuario_id" UUID,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "busqueda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oferta_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "canal" "canal_contacto" NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carga_planilla" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tienda_id" UUID NOT NULL,
    "creada_por_id" UUID NOT NULL,
    "archivo" VARCHAR(200) NOT NULL,
    "filas" JSONB NOT NULL DEFAULT '[]',
    "estado" "estado_carga" NOT NULL DEFAULT 'BORRADOR',
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carga_planilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "objeto" VARCHAR(40) NOT NULL,
    "objeto_id" UUID,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "galeria_nombre_key" ON "galeria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "galeria_slug_key" ON "galeria"("slug");

-- CreateIndex
CREATE INDEX "tienda_galeria_id_idx" ON "tienda"("galeria_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "usuario_tienda_id_idx" ON "usuario"("tienda_id");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_slug_key" ON "categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "marca_nombre_key" ON "marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "marca_slug_key" ON "marca"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "producto_slug_key" ON "producto"("slug");

-- CreateIndex
CREATE INDEX "producto_categoria_id_idx" ON "producto"("categoria_id");

-- CreateIndex
CREATE INDEX "producto_marca_id_idx" ON "producto"("marca_id");

-- CreateIndex
CREATE INDEX "producto_texto_busqueda_trgm_idx" ON "producto" USING GIN ("texto_busqueda" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "producto_foto_producto_id_idx" ON "producto_foto"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "etiqueta_clave_key" ON "etiqueta"("clave");

-- CreateIndex
CREATE INDEX "producto_etiqueta_etiqueta_id_idx" ON "producto_etiqueta"("etiqueta_id");

-- CreateIndex
CREATE INDEX "oferta_producto_id_estado_idx" ON "oferta"("producto_id", "estado");

-- CreateIndex
CREATE INDEX "oferta_tienda_id_estado_idx" ON "oferta"("tienda_id", "estado");

-- CreateIndex
CREATE INDEX "oferta_responsable_id_idx" ON "oferta"("responsable_id");

-- CreateIndex
CREATE UNIQUE INDEX "oferta_vigente_key" ON "oferta"("producto_id", "tienda_id", "condicion", "vigente");

-- CreateIndex
CREATE INDEX "oferta_foto_oferta_id_idx" ON "oferta_foto"("oferta_id");

-- CreateIndex
CREATE INDEX "termino_palabra_trgm_idx" ON "termino" USING GIN ("palabra" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "conversacion_comprador_id_ultimo_mensaje_en_idx" ON "conversacion"("comprador_id", "ultimo_mensaje_en");

-- CreateIndex
CREATE INDEX "conversacion_vendedor_id_ultimo_mensaje_en_idx" ON "conversacion"("vendedor_id", "ultimo_mensaje_en");

-- CreateIndex
CREATE UNIQUE INDEX "conversacion_oferta_id_comprador_id_key" ON "conversacion"("oferta_id", "comprador_id");

-- CreateIndex
CREATE INDEX "participacion_usuario_id_idx" ON "participacion"("usuario_id");

-- CreateIndex
CREATE INDEX "mensaje_conversacion_id_creado_en_idx" ON "mensaje"("conversacion_id", "creado_en");

-- CreateIndex
CREATE INDEX "respuesta_rapida_usuario_id_idx" ON "respuesta_rapida"("usuario_id");

-- CreateIndex
CREATE INDEX "denuncia_estado_creada_en_idx" ON "denuncia"("estado", "creada_en");

-- CreateIndex
CREATE INDEX "venta_oferta_id_idx" ON "venta"("oferta_id");

-- CreateIndex
CREATE INDEX "aviso_usuario_id_leido_en_visible_desde_idx" ON "aviso"("usuario_id", "leido_en", "visible_desde");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_usuario_id_conversacion_id_key" ON "aviso"("usuario_id", "conversacion_id");

-- CreateIndex
CREATE INDEX "busqueda_creada_en_idx" ON "busqueda"("creada_en");

-- CreateIndex
CREATE INDEX "contacto_oferta_id_idx" ON "contacto"("oferta_id");

-- CreateIndex
CREATE INDEX "contacto_creado_en_idx" ON "contacto"("creado_en");

-- CreateIndex
CREATE INDEX "auditoria_creada_en_idx" ON "auditoria"("creada_en");

-- AddForeignKey
ALTER TABLE "tienda" ADD CONSTRAINT "tienda_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galeria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_creado_por_tienda_id_fkey" FOREIGN KEY ("creado_por_tienda_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_fusionado_en_id_fkey" FOREIGN KEY ("fusionado_en_id") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_foto" ADD CONSTRAINT "producto_foto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_etiqueta" ADD CONSTRAINT "producto_etiqueta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_etiqueta" ADD CONSTRAINT "producto_etiqueta_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiqueta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oferta_foto" ADD CONSTRAINT "oferta_foto_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_tienda_compradora_id_fkey" FOREIGN KEY ("tienda_compradora_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_tienda_vendedora_id_fkey" FOREIGN KEY ("tienda_vendedora_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacion" ADD CONSTRAINT "participacion_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacion" ADD CONSTRAINT "participacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuesta_rapida" ADD CONSTRAINT "respuesta_rapida_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueo" ADD CONSTRAINT "bloqueo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueo" ADD CONSTRAINT "bloqueo_tienda_bloqueada_id_fkey" FOREIGN KEY ("tienda_bloqueada_id") REFERENCES "tienda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denuncia" ADD CONSTRAINT "denuncia_denunciante_id_fkey" FOREIGN KEY ("denunciante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_tienda_compradora_id_fkey" FOREIGN KEY ("tienda_compradora_id") REFERENCES "tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_registrada_por_id_fkey" FOREIGN KEY ("registrada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso" ADD CONSTRAINT "aviso_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencia_aviso" ADD CONSTRAINT "preferencia_aviso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "busqueda" ADD CONSTRAINT "busqueda_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_planilla" ADD CONSTRAINT "carga_planilla_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carga_planilla" ADD CONSTRAINT "carga_planilla_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Reglas que Prisma no expresa (docs/05-arquitectura.md §4.3) ──────────────

-- El equipo no pertenece a ninguna tienda; dueños y asesores siempre a una.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_tienda_check"
  CHECK (("rol" = 'EQUIPO') = ("tienda_id" IS NULL));

ALTER TABLE "usuario" ADD CONSTRAINT "usuario_no_molestar_check"
  CHECK (
    ("no_molestar_desde" IS NULL) = ("no_molestar_hasta" IS NULL)
    AND ("no_molestar_desde" IS NULL OR "no_molestar_desde" BETWEEN 0 AND 1439)
    AND ("no_molestar_hasta" IS NULL OR "no_molestar_hasta" BETWEEN 0 AND 1439)
  );

-- Una tienda de galería tiene galería; un independiente puede no tenerla (RF-01).
ALTER TABLE "tienda" ADD CONSTRAINT "tienda_galeria_check"
  CHECK ("tipo" <> 'TIENDA' OR "galeria_id" IS NOT NULL);

-- Stock nunca negativo; dinero en céntimos enteros; un precio visible necesita monto.
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_stock_check" CHECK ("stock" >= 0);
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_precio_check"
  CHECK ("precio_centimos" IS NULL OR "precio_centimos" >= 0);
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_precio_visible_check"
  CHECK (NOT "precio_visible" OR "precio_centimos" IS NOT NULL);

-- `vigente` es true mientras la oferta no esté eliminada y nulo al eliminarla.
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_vigente_check"
  CHECK (("estado" = 'ELIMINADA') = ("vigente" IS NULL) AND ("vigente" IS NULL OR "vigente"));

ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_personas_check"
  CHECK ("comprador_id" <> "vendedor_id");

ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_contenido_check"
  CHECK (
    ("tipo" = 'FOTO' AND "foto" IS NOT NULL)
    OR ("tipo" <> 'FOTO' AND "texto" IS NOT NULL)
  );

ALTER TABLE "venta" ADD CONSTRAINT "venta_stock_check"
  CHECK ("stock_antes" > 0 AND "stock_despues" = "stock_antes" - 1);
