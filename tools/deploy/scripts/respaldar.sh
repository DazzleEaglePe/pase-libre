#!/usr/bin/env sh
# Respaldo de PaseLibre (docs/05 §10, RNF-13): la base en formato custom de pg_dump y,
# si hay RCLONE_DESTINO, la copia de los respaldos y de las fotos fuera del servidor.
#
# Uso: ./respaldar.sh <respaldo.env>
#
# - Diarios: se conservan 7. Semanales: el del domingo (o el primero que se haga), 4.
# - El archivo se escribe con nombre temporal, se valida con `pg_restore --list` y recién
#   entonces se publica con un movimiento atómico: un corte no deja un respaldo a medias.

set -eu
. "$(dirname "$0")/comun.sh"
cargar_entorno "$1"

diarios="$RESPALDO_DIR/diarios"
semanales="$RESPALDO_DIR/semanales"
mkdir -p "$diarios" "$semanales"

momento="$(date -u +%Y%m%dT%H%M%SZ)"
nombre="paselibre-${ENTORNO}-${momento}.dump"
parcial="$(mktemp "$diarios/.${nombre}.XXXXXX")"
trap 'rm -f "$parcial"' EXIT HUP INT TERM

echo "Respaldando ${POSTGRES_DB} (${ENTORNO}) en ${diarios}/${nombre}"
if ! en_postgres pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom >"$parcial"; then
  echo "pg_dump falló: no se publica un respaldo a medias." >&2
  exit 1
fi
bytes="$(wc -c <"$parcial" | tr -d ' ')"
if [ "$bytes" -eq 0 ]; then
  echo "El respaldo quedó vacío. Revisa pg_dump antes de confiar en él." >&2
  exit 1
fi
if ! en_postgres pg_restore --list <"$parcial" >/dev/null; then
  echo "El archivo no es un respaldo custom válido: se descarta." >&2
  exit 1
fi
mv "$parcial" "$diarios/$nombre"
trap - EXIT HUP INT TERM
echo "Listo: ${bytes} bytes."

# Semanal: los domingos, o si todavía no hay ninguno. Enlace duro: no ocupa el doble.
if [ "$(date -u +%u)" = 7 ] || [ -z "$(ultimo_respaldo "$semanales")" ]; then
  ln -f "$diarios/$nombre" "$semanales/$nombre"
  echo "También queda como semanal."
fi

podar() {
  ls -1 "$1" | grep '^paselibre-.*\.dump$' | sort -r | tail -n "+$(($2 + 1))" |
    while IFS= read -r viejo; do
      rm -f -- "$1/$viejo"
      echo "Se borró el respaldo viejo $viejo"
    done
}
podar "$diarios" 7
podar "$semanales" 4

if [ -z "$RCLONE_DESTINO" ]; then
  echo "AVISO: sin RCLONE_DESTINO no hay copia fuera del servidor. Si se pierde el disco, se pierden los respaldos." >&2
  exit 0
fi
command -v rclone >/dev/null || { echo "Falta rclone para copiar a ${RCLONE_DESTINO}." >&2; exit 1; }

# La base se espeja (con la misma poda); las fotos solo se copian: nunca se borran allá.
rclone sync "$RESPALDO_DIR" "${RCLONE_DESTINO}/base" --exclude '.*'
if [ -n "$MEDIA_DIR" ]; then
  rclone copy "$MEDIA_DIR" "${RCLONE_DESTINO}/media"
fi
echo "Copia externa en ${RCLONE_DESTINO} al día."
