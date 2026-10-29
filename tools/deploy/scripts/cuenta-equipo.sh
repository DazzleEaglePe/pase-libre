#!/usr/bin/env sh
# Crea la primera cuenta del equipo en un entorno sin semilla de demostración (README, «Primera
# cuenta del equipo»). Muestra una clave temporal una sola vez; el primer ingreso obliga a cambiarla.
#
# Uso: ./cuenta-equipo.sh <despliegue.env> --usuario dazz --nombre "Dazz" [--correo dazz@ejemplo.pe]

set -eu
. "$(dirname "$0")/compose-comun.sh"
cargar_despliegue "${1:-}"
shift

compose run --rm -T --no-deps \
  --entrypoint ./node_modules/.bin/tsx migrate scripts/crear-cuenta-equipo.ts "$@"
