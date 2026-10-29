# Funciones que comparten los scripts de despliegue. Se carga con `. compose-comun.sh`.

# Lee el archivo de entorno del despliegue (despliegue.env.example) y deja listas las rutas.
cargar_despliegue() {
  archivo="${1:-}"
  [ -n "$archivo" ] || { echo "Falta el archivo de entorno (ver tools/deploy/despliegue.env.example)." >&2; exit 1; }
  [ -f "$archivo" ] || { echo "No existe el archivo de entorno: $archivo" >&2; exit 1; }
  ENV_FILE="$(cd "$(dirname "$archivo")" && pwd)/$(basename "$archivo")"
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  : "${ENTORNO:?Falta ENTORNO en $ENV_FILE}"
  RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
  COMPOSE_YML="$RAIZ/tools/deploy/compose.yml"
  [ -f "$COMPOSE_YML" ] || { echo "No existe el compose: $COMPOSE_YML" >&2; exit 1; }
}

# docker compose con el archivo de entorno del despliegue.
compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_YML" "$@"
}

# Cambia (o agrega) NOMBRE=valor en el archivo de entorno sin cambiarle los permisos.
fijar_variable() {
  archivo="$1"
  nombre="$2"
  valor="$3"
  temporal="$(mktemp)"
  if grep -q "^${nombre}=" "$archivo"; then
    awk -v n="$nombre" -v v="$valor" 'BEGIN { FS = OFS = "=" } $1 == n { print n "=" v; next } { print }' "$archivo" >"$temporal"
  else
    cat "$archivo" >"$temporal"
    printf '%s=%s\n' "$nombre" "$valor" >>"$temporal"
  fi
  cat "$temporal" >"$archivo"
  rm -f "$temporal"
}

# Espera a que un servicio de compose quede sano. Si se cae, muestra sus últimas líneas.
esperar_sano() {
  servicio="$1"
  intentos="${2:-90}"
  contenedor="$(compose ps -q "$servicio")"
  [ -n "$contenedor" ] || { echo "El servicio $servicio no tiene contenedor." >&2; return 1; }
  n=1
  while [ "$n" -le "$intentos" ]; do
    estado="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$contenedor" 2>/dev/null || true)"
    [ "$estado" = healthy ] && return 0
    case "$estado" in
      unhealthy | exited | dead)
        echo "$servicio terminó en estado $estado. Sus últimas líneas:" >&2
        docker logs --tail 60 "$contenedor" >&2 || true
        return 1
        ;;
    esac
    sleep 1
    n=$((n + 1))
  done
  echo "$servicio no quedó sano en ${intentos} segundos." >&2
  docker logs --tail 60 "$contenedor" >&2 || true
  return 1
}
