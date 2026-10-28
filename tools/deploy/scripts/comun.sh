# Funciones que comparten los scripts de respaldo. Se carga con `. comun.sh`.

cargar_entorno() {
  archivo="${1:?Falta el archivo de entorno (ver tools/deploy/respaldo.env.example)}"
  [ -f "$archivo" ] || { echo "No existe el archivo de entorno: $archivo" >&2; exit 1; }
  # shellcheck disable=SC1090
  . "$archivo"
  : "${COMPOSE_FILE:?Falta COMPOSE_FILE en $archivo}"
  : "${POSTGRES_USER:?Falta POSTGRES_USER en $archivo}"
  : "${POSTGRES_DB:=paselibre}"
  : "${COMPOSE_SERVICIO:=postgres}"
  : "${ENTORNO:=local}"
  : "${RESPALDO_DIR:=./respaldos}"
  : "${MEDIA_DIR:=}"
  : "${RCLONE_DESTINO:=}"
  [ -f "$COMPOSE_FILE" ] || { echo "No existe el compose: $COMPOSE_FILE" >&2; exit 1; }
}

# Comando dentro del contenedor de Postgres. -T: sin terminal, para poder redirigir.
en_postgres() {
  docker compose -f "$COMPOSE_FILE" exec -T "$COMPOSE_SERVICIO" "$@"
}

# Un valor de una consulta, sin cabeceras ni espacios.
consultar() {
  base="$1"
  shift
  en_postgres psql --username "$POSTGRES_USER" --dbname "$base" \
    --tuples-only --no-align --quiet --command "$*" | tr -d '[:space:]'
}

# Respaldo más reciente de una carpeta (los nombres llevan la fecha en UTC).
ultimo_respaldo() {
  ls -1 "$1" 2>/dev/null | grep '^paselibre-.*\.dump$' | sort | tail -n 1
}
