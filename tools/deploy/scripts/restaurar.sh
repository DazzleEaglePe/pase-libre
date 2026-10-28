#!/usr/bin/env sh
# Restaura un respaldo de respaldar.sh sobre la base de la aplicación.
#
# Uso: ./restaurar.sh <respaldo.env> <archivo.dump> [--force]
#
# Se niega a pisar una base que ya tiene cuentas salvo con --force: restaurar encima de
# un ambiente con datos no tiene vuelta atrás. Antes de usar --force, respalda el estado
# actual. Para probar un respaldo sin tocar nada, usa ensayar-restauracion.sh.

set -eu
. "$(dirname "$0")/comun.sh"
cargar_entorno "$1"
respaldo="${2:?Uso: restaurar.sh <respaldo.env> <archivo.dump> [--force]}"
forzar="${3:-}"
[ -f "$respaldo" ] || { echo "No existe el respaldo: $respaldo" >&2; exit 1; }

if ! en_postgres pg_restore --list <"$respaldo" >/dev/null; then
  echo "El archivo no es un respaldo custom válido: $respaldo" >&2
  exit 1
fi

if [ "$forzar" != "--force" ]; then
  cuentas="$(consultar "$POSTGRES_DB" 'SELECT count(*) FROM usuario' 2>/dev/null || echo 0)"
  if [ "${cuentas:-0}" != "0" ]; then
    echo "La base ${POSTGRES_DB} ya tiene ${cuentas} cuenta(s). Restaurar encima las borra sin" >&2
    echo "vuelta atrás. Si es lo que quieres, respalda primero y vuelve a correr con --force." >&2
    exit 1
  fi
fi

echo "Restaurando ${respaldo} en ${POSTGRES_DB}"
# --clean --if-exists: queda exactamente como el respaldo. --single-transaction: todo o nada.
en_postgres pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --clean --if-exists --single-transaction --no-owner --no-privileges <"$respaldo"
echo "Restauración completa. Revisa GET /v1/salud/lista y entra con una cuenta de prueba."
