#!/usr/bin/env sh
# Ensayo de restauración (RNF-13, «restauración probada»): restaura un respaldo en una
# base aparte, la compara con la de la aplicación y revisa que existan las fotos. No toca
# la base de la aplicación.
#
# Uso: ./ensayar-restauracion.sh <respaldo.env> [archivo.dump] [--conservar]
#
# Sin archivo, usa el último respaldo diario. Con --conservar, deja la base de ensayo para
# revisarla a mano (se llama <base>_ensayo).

set -eu
. "$(dirname "$0")/comun.sh"
cargar_entorno "$1"
respaldo="${2:-}"
conservar="${3:-}"
if [ "$respaldo" = "--conservar" ]; then
  conservar="--conservar"
  respaldo=""
fi
if [ -z "$respaldo" ]; then
  ultimo="$(ultimo_respaldo "$RESPALDO_DIR/diarios")"
  [ -n "$ultimo" ] || { echo "No hay respaldos en $RESPALDO_DIR/diarios." >&2; exit 1; }
  respaldo="$RESPALDO_DIR/diarios/$ultimo"
fi
[ -f "$respaldo" ] || { echo "No existe el respaldo: $respaldo" >&2; exit 1; }

ensayo="${POSTGRES_DB}_ensayo"
case "$ensayo" in *_ensayo) ;; *) echo "Nombre de base de ensayo inesperado." >&2; exit 1 ;; esac

limpiar() {
  [ "$conservar" = "--conservar" ] && return 0
  en_postgres dropdb --username "$POSTGRES_USER" --if-exists "$ensayo" >/dev/null 2>&1 || true
}
trap limpiar EXIT HUP INT TERM

echo "Ensayo con $(basename "$respaldo")"
en_postgres dropdb --username "$POSTGRES_USER" --if-exists "$ensayo"
en_postgres createdb --username "$POSTGRES_USER" "$ensayo"
en_postgres pg_restore --username "$POSTGRES_USER" --dbname "$ensayo" \
  --single-transaction --no-owner --no-privileges --exit-on-error <"$respaldo"
echo "Se restauró en ${ensayo}."

fallas=0
migraciones_respaldo="$(consultar "$ensayo" 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')"
migraciones_vivo="$(consultar "$POSTGRES_DB" 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')"
if [ "$migraciones_respaldo" != "$migraciones_vivo" ]; then
  echo "El respaldo tiene ${migraciones_respaldo} migraciones y la base ${migraciones_vivo}: es de otra versión." >&2
  fallas=1
fi

printf '%-14s %12s %12s\n' 'Tabla' 'Respaldo' 'Ahora'
for tabla in usuario tienda producto oferta conversacion mensaje venta archivo; do
  en_respaldo="$(consultar "$ensayo" "SELECT count(*) FROM $tabla")"
  ahora="$(consultar "$POSTGRES_DB" "SELECT count(*) FROM $tabla")"
  printf '%-14s %12s %12s\n' "$tabla" "$en_respaldo" "$ahora"
done
echo "(Si hubo actividad después del respaldo, «Ahora» puede tener más filas.)"

if [ -n "$MEDIA_DIR" ]; then
  faltan=0
  total=0
  rutas="$(en_postgres psql --username "$POSTGRES_USER" --dbname "$ensayo" --tuples-only --no-align --quiet --command \
    "SELECT ruta FROM producto_foto UNION SELECT ruta FROM oferta_foto UNION SELECT foto FROM mensaje WHERE foto IS NOT NULL UNION SELECT logo FROM tienda WHERE logo IS NOT NULL")"
  for ruta in $rutas; do
    total=$((total + 1))
    if [ ! -f "$MEDIA_DIR/$ruta" ]; then
      faltan=$((faltan + 1))
      echo "Falta la foto $ruta" >&2
    fi
  done
  echo "Fotos: ${total} en uso, ${faltan} faltan en ${MEDIA_DIR}."
  [ "$faltan" -eq 0 ] || fallas=1
fi

if [ "$fallas" -ne 0 ]; then
  echo "El ensayo encontró problemas: revisa lo de arriba." >&2
  exit 1
fi
echo "Ensayo correcto: el respaldo se puede restaurar."
