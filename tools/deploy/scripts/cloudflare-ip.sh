#!/bin/bash
# Rangos de Cloudflare para que nginx vea la IP real de cada persona detrás de Cloudflare
# (docs/16 §4.1). Sin esto, todas las tiendas parecerían venir de unas pocas IPs de Cloudflare
# y compartirían los límites por IP. Solo se cree la cabecera CF-Connecting-IP cuando el pedido
# llega desde un rango de Cloudflare: alguien que entra directo no puede inventarse una IP.
#
# Se instala como /usr/local/sbin/paselibre-cloudflare-ip.sh y lo corre un cron semanal
# (tools/deploy/cron/paselibre-cloudflare-ip). Si la lista que baja no parece válida, o nginx no
# acepta el archivo nuevo, deja el anterior y sale con error.
set -euo pipefail

DESTINO=/etc/nginx/snippets/paselibre-cloudflare-ip.conf
NUEVO=$(mktemp)
trap 'rm -f "$NUEVO"' EXIT

{
  echo "# Generado por paselibre-cloudflare-ip.sh el $(date -u +%Y-%m-%dT%H:%MZ). No editar a mano."
  for familia in v4 v6; do
    curl -fsS --max-time 20 "https://www.cloudflare.com/ips-$familia" | while read -r rango || [ -n "$rango" ]; do
      [ -n "$rango" ] || continue
      if [[ ! "$rango" =~ ^[0-9a-fA-F:.]+/[0-9]{1,3}$ ]]; then
        echo "Rango con forma rara: $rango" >&2
        exit 1
      fi
      echo "set_real_ip_from $rango;"
    done
  done
  echo "real_ip_header CF-Connecting-IP;"
} > "$NUEVO"

rangos=$(grep -c '^set_real_ip_from' "$NUEVO" || true)
if [ "$rangos" -lt 10 ]; then
  echo "Solo llegaron $rangos rangos: no cambio nada." >&2
  exit 1
fi

if [ -f "$DESTINO" ] && cmp -s <(grep -v '^#' "$NUEVO") <(grep -v '^#' "$DESTINO"); then
  echo "Sin cambios en los rangos de Cloudflare ($rangos)."
  exit 0
fi

ANTERIOR=""
if [ -f "$DESTINO" ]; then
  ANTERIOR=$(mktemp)
  cp -a "$DESTINO" "$ANTERIOR"
fi
install -m 644 -o root -g root "$NUEVO" "$DESTINO"
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "Rangos de Cloudflare actualizados: $rangos."
  [ -n "$ANTERIOR" ] && rm -f "$ANTERIOR"
else
  echo "nginx no aceptó los rangos nuevos: dejo los anteriores." >&2
  if [ -n "$ANTERIOR" ]; then cp -a "$ANTERIOR" "$DESTINO"; rm -f "$ANTERIOR"; else rm -f "$DESTINO"; fi
  exit 1
fi
