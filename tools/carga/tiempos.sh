#!/bin/bash
# Mide cada endpoint público 5 veces, uno a la vez, sobre una API local con los datos sintéticos (docs/16 §3).
#   BASE=http://localhost:3042 bash tools/carga/tiempos.sh
B=${BASE:-http://localhost:3042}/v1
medir() { local etiqueta="$1"; shift; local ts=(); for i in 1 2 3 4 5; do ts+=($(curl -s -o /dev/null -w "%{time_total}" -H "X-Forwarded-For: 10.9.$i.$RANDOM" "$@")); done; printf "%-34s" "$etiqueta"; printf "%s " "${ts[@]}" | awk '{for(i=1;i<=NF;i++){s+=$i; if($i>m)m=$i}; printf "media %.0f ms  máx %.0f ms\n", s/NF*1000, m*1000}'; }
medir "portada"                "$B/portada"
medir "categorias"             "$B/categorias"
medir "buscar ryzen"           "$B/buscar?q=ryzen"
medir "buscar pro (muy común)" "$B/buscar?q=pro"
medir "buscar rtx 4090"        "$B/buscar?q=rtx%204090"
medir "buscar ryzen precio_asc" "$B/buscar?q=ryzen&orden=precio_asc"
medir "buscar sin texto"       "$B/buscar"
medir "sugerencias rty"        "$B/buscar/sugerencias?q=rty"
medir "sugerencias ryz"        "$B/buscar/sugerencias?q=ryz"
medir "populares"              "$B/buscar/populares"
medir "inicio"                 "$B/inicio"
medir "wilson"                 "$B/wilson"
medir "mapa-del-sitio"         "$B/mapa-del-sitio"
