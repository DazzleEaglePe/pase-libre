#!/usr/bin/env sh
# Carga en un staging las tiendas, cuentas y productos de demostración del lienzo.
# Nunca en producción. Las cuentas llevan CLAVE_DEMO (del archivo de entorno), no la del
# repositorio, que es pública.
#
# Uso: ./semilla-demo.sh <despliegue.env>
#
# Se puede correr varias veces: deja las cuentas demo como al inicio.

set -eu
. "$(dirname "$0")/compose-comun.sh"
cargar_despliegue "${1:-}"

[ "$ENTORNO" != produccion ] || {
  echo "La semilla de demostración no se carga en producción: crea cuentas con claves conocidas." >&2
  exit 1
}
[ -n "${CLAVE_DEMO:-}" ] || {
  echo "Define CLAVE_DEMO en $ENV_FILE (12 caracteres o más, distinta de la del repositorio)." >&2
  exit 1
}
[ "${#CLAVE_DEMO}" -ge 12 ] || { echo "CLAVE_DEMO es muy corta: 12 caracteres o más." >&2; exit 1; }
[ "$CLAVE_DEMO" != "pase-demo-2026" ] || {
  echo "CLAVE_DEMO es la del repositorio, que es pública. Pon otra." >&2
  exit 1
}

# La semilla se niega a correr con NODE_ENV=production; aquí se baja a propósito, ya revisado el entorno.
compose run --rm -T --no-deps \
  -e NODE_ENV=development -e SEMILLA_DEMO=true -e "CLAVE_DEMO=${CLAVE_DEMO}" \
  --entrypoint ./node_modules/.bin/tsx migrate prisma/seed.ts
