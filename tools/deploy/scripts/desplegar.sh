#!/usr/bin/env sh
# Despliega PaseLibre en este servidor (docs/05 §10).
#
# Uso: ./desplegar.sh <despliegue.env> [etiqueta]
#
# Sin etiqueta, construye las imágenes del commit actual del repositorio (que tiene que estar
# limpio) y las pone en marcha. Con etiqueta, usa imágenes ya construidas: es la forma de revertir
# (la anterior queda en IMAGEN_TAG_ANTERIOR del archivo de entorno).
#
# Pasos:
#   1. Construir las imágenes (o usar las de la etiqueta).
#   2. Respaldar la base, si ya existe.
#   3. Correr las migraciones y la semilla base (idempotente).
#   4. Cambiar las imágenes de la API y la web.
#   5. Prueba de humo contra la dirección pública.
#
# Variables opcionales: DESPLIEGUE_SUCIO=true (despliega con cambios sin confirmar),
# DESPLIEGUE_SIN_RESPALDO=true, DESPLIEGUE_SIN_HUMO=true.
#
# Las migraciones solo avanzan: revertir las imágenes no deshace una migración. Si una migración
# rompe algo, se restaura el respaldo que este script hizo antes (RESPALDOS.md).

set -eu
. "$(dirname "$0")/compose-comun.sh"
cargar_despliegue "${1:-}"
etiqueta="${2:-}"

if [ -z "$etiqueta" ]; then
  git -C "$RAIZ" rev-parse --git-dir >/dev/null 2>&1 || { echo "$RAIZ no es un repositorio de git." >&2; exit 1; }
  etiqueta="$(git -C "$RAIZ" rev-parse --short=8 HEAD)"
  if [ -n "$(git -C "$RAIZ" status --porcelain)" ]; then
    [ "${DESPLIEGUE_SUCIO:-false}" = true ] || {
      echo "Hay cambios sin confirmar en $RAIZ. Confírmalos o usa DESPLIEGUE_SUCIO=true." >&2
      exit 1
    }
    etiqueta="${etiqueta}-sucio$(date -u +%H%M%S)"
  fi

  echo "==> Construyendo las imágenes (${etiqueta})"
  docker build -f "$RAIZ/apps/api/Dockerfile" --target runtime -t "paselibre-api:${etiqueta}" "$RAIZ"
  docker build -f "$RAIZ/apps/api/Dockerfile" --target migraciones -t "paselibre-migraciones:${etiqueta}" "$RAIZ"
  docker build -f "$RAIZ/apps/web/Dockerfile" \
    --build-arg "NEXT_PUBLIC_WHATSAPP_EQUIPO=${NEXT_PUBLIC_WHATSAPP_EQUIPO:-}" \
    -t "paselibre-web:${etiqueta}" "$RAIZ"
else
  for imagen in api web migraciones; do
    docker image inspect "paselibre-${imagen}:${etiqueta}" >/dev/null 2>&1 || {
      echo "No existe la imagen paselibre-${imagen}:${etiqueta} en este servidor." >&2
      exit 1
    }
  done
  echo "==> Usando las imágenes ya construidas (${etiqueta})"
fi

# Respaldo antes de tocar la base. En el primer despliegue todavía no hay base que respaldar.
if [ -n "$(compose ps -q postgres 2>/dev/null)" ]; then
  if [ "${DESPLIEGUE_SIN_RESPALDO:-false}" = true ]; then
    echo "==> Sin respaldo previo (DESPLIEGUE_SIN_RESPALDO=true)"
  else
    [ -n "${RESPALDO_ENV:-}" ] && [ -f "$RESPALDO_ENV" ] || {
      echo "Ya hay una base y no encuentro RESPALDO_ENV en $ENV_FILE: no migro sin respaldo." >&2
      exit 1
    }
    echo "==> Respaldando la base"
    "$(dirname "$0")/respaldar.sh" "$RESPALDO_ENV"
  fi
else
  echo "==> Primer despliegue de ${ENTORNO}: no hay base que respaldar"
fi

# Las imágenes en uso quedan escritas en el archivo de entorno; la anterior sirve para revertir.
if [ "${IMAGEN_TAG:-}" != "$etiqueta" ]; then
  anterior="${IMAGEN_TAG:-}"
  fijar_variable "$ENV_FILE" IMAGEN_TAG_ANTERIOR "$anterior"
  fijar_variable "$ENV_FILE" IMAGEN_TAG "$etiqueta"
else
  anterior="${IMAGEN_TAG_ANTERIOR:-}"
fi

echo "==> Base de datos"
compose up -d postgres
esperar_sano postgres 60

echo "==> Migraciones"
compose run --rm -T migrate

echo "==> Semilla base (galerías, categorías y marcas; no pisa lo que ya existe)"
compose run --rm -T --no-deps --entrypoint ./node_modules/.bin/tsx migrate prisma/seed.ts

echo "==> API y web"
compose up -d --no-deps --force-recreate api web
esperar_sano api 90
esperar_sano web 60

if [ "${DESPLIEGUE_SIN_HUMO:-false}" = true ]; then
  echo "==> Sin prueba de humo (DESPLIEGUE_SIN_HUMO=true)"
else
  echo "==> Prueba de humo"
  "$(dirname "$0")/humo.sh" "${HUMO_URL:-${PUBLIC_URL:?Falta PUBLIC_URL en $ENV_FILE}}" || {
    echo "La prueba de humo falló. Para volver a la versión anterior:" >&2
    [ -n "$anterior" ] && echo "  $0 $ENV_FILE $anterior" >&2
    exit 1
  }
fi

echo "Listo: ${ENTORNO} corre ${etiqueta}."
[ -n "$anterior" ] && echo "Para revertir: $0 $ENV_FILE $anterior"
exit 0
