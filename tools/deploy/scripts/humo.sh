#!/usr/bin/env sh
# Prueba de humo de PaseLibre (docs/05 §13): después de cada despliegue, lo mínimo que tiene que
# responder bien, visto desde afuera, igual que lo vería un visitante.
#
# Uso: ./humo.sh <dirección del sitio, por ejemplo https://staging.paselibre.example>
#
# Con HUMO_USUARIO y HUMO_CLAVE (una cuenta de prueba) también ingresa y sale. Termina con
# error si algo falla. Revisa de paso que la respuesta del visitante no traiga precio ni tienda.

set -eu
base="${1:?Uso: humo.sh <dirección del sitio>}"
base="${base%/}"

carpeta="$(mktemp -d)"
trap 'rm -rf "$carpeta"' EXIT HUP INT TERM
fallas=0

ok() { echo "  ok     $1"; }
falla() {
  echo "  FALLA  $1"
  fallas=$((fallas + 1))
}

# pedir <metodo> <ruta> [curl...]: deja el cuerpo en $carpeta/cuerpo y el estado en $estado.
pedir() {
  metodo="$1"
  ruta="$2"
  shift 2
  estado="$(curl -sS -o "$carpeta/cuerpo" -w '%{http_code}' --max-time 20 -X "$metodo" "$@" "${base}${ruta}" 2>/dev/null || echo 000)"
}

# comprobar <descripcion> <metodo> <ruta> <estado esperado> [texto que debe aparecer] [curl...]
comprobar() {
  descripcion="$1"
  metodo="$2"
  ruta="$3"
  esperado="$4"
  texto="${5:-}"
  [ "$#" -ge 5 ] && shift 5 || shift 4
  pedir "$metodo" "$ruta" "$@"
  if [ "$estado" != "$esperado" ]; then
    falla "$descripcion (respondió $estado, esperaba $esperado)"
  elif [ -n "$texto" ] && ! grep -q -- "$texto" "$carpeta/cuerpo"; then
    falla "$descripcion (no aparece «$texto»)"
  else
    ok "$descripcion"
  fi
}

echo "Prueba de humo en ${base}"

comprobar "La API está lista y llega a la base" GET /v1/salud/lista 200 '"base_de_datos":"ok"'
comprobar "La portada responde" GET / 200 '<html'
comprobar "La búsqueda responde" GET '/buscar?q=rtx' 200 '<html'
comprobar "Sin sesión, /v1/yo dice que no" GET /v1/yo 401

# Lo que ve el visitante no puede traer precio, tienda, stand ni WhatsApp (RNF-18).
pedir GET /v1/portada
if [ "$estado" != 200 ]; then
  falla "La portada de la API responde (respondió $estado)"
elif ! grep -q '"audiencia":"visitante"' "$carpeta/cuerpo"; then
  falla "La portada de la API es la del visitante"
elif grep -q -E '"(precio|precios_desde|tienda|stand|whatsapp)"' "$carpeta/cuerpo"; then
  falla "La portada del visitante trae datos privados"
else
  ok "La portada del visitante no trae precio ni tienda"
fi

# El socket del chat llega a la API (nginx lleva /tiempo-real con el upgrade de WebSocket).
pedir GET '/tiempo-real/?EIO=4&transport=polling'
if [ "$estado" = 200 ] && head -c 2 "$carpeta/cuerpo" | grep -q '^0{'; then
  ok "El socket del chat contesta"
else
  falla "El socket del chat contesta (respondió $estado)"
fi

comprobar "Una foto que no existe da 404 (no 502)" GET /media/no-existe.webp 404

if [ -n "${HUMO_USUARIO:-}" ] && [ -n "${HUMO_CLAVE:-}" ]; then
  galleta="$carpeta/galleta"
  # La API pide X-PaseLibre en lo que cambia datos: un formulario de otro sitio no puede ponerla.
  pedir POST /v1/sesion -c "$galleta" -H 'Content-Type: application/json' -H 'X-PaseLibre: web' \
    -d "{\"usuario\":\"${HUMO_USUARIO}\",\"clave\":\"${HUMO_CLAVE}\"}"
  if [ "$estado" = 200 ]; then
    ok "Ingresa con la cuenta de prueba"
    comprobar "Con sesión, /v1/yo responde" GET /v1/yo 200 '' -b "$galleta"
    pedir DELETE /v1/sesion -b "$galleta" -H 'X-PaseLibre: web'
    case "$estado" in 2*) ok "Sale de la sesión" ;; *) falla "Sale de la sesión (respondió $estado)" ;; esac
  else
    falla "Ingresa con la cuenta de prueba (respondió $estado)"
  fi
else
  echo "  --     Sin HUMO_USUARIO y HUMO_CLAVE: no se prueba el ingreso"
fi

if [ "$fallas" -gt 0 ]; then
  echo "Falló ${fallas} comprobación(es)." >&2
  exit 1
fi
echo "Todo en orden."
