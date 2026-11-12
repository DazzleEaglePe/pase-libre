# Prueba de carga de la API

Mide cuánto aguanta la API y cuánto tarda cada ruta con muchas tiendas a la vez. Sin
dependencias: Node 22+ y una base de prueba. **Nunca contra producción** (el script solo apunta
a localhost salvo con `--permitir-remoto`).

## Preparar una base con volumen

```bash
docker exec paselibre-local-postgres-1 psql -U paselibre -d postgres -c "CREATE DATABASE paselibre_carga"
cd apps/api
DATABASE_URL=postgresql://paselibre:paselibre_dev@localhost:5435/paselibre_carga pnpm exec prisma migrate deploy
DATABASE_URL=postgresql://paselibre:paselibre_dev@localhost:5435/paselibre_carga SEMILLA_DEMO=true pnpm exec prisma db seed
pnpm build
NODE_ENV=production DATABASE_URL=…/paselibre_carga EN_VIVO=true PORT=3031 LOG_LEVEL=warn MEDIA_DIR=/tmp/media-carga node dist/src/main.js
```

En otra terminal, el catálogo raspado (ver `tools/datos-demo`) y el volumen:

```bash
DATABASE_URL=…/paselibre_carga node tools/datos-demo/cargar.mjs --pases --api=http://localhost:3031/v1
docker exec -i paselibre-local-postgres-1 psql -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/volumen.sql
```

`volumen.sql` se niega a correr en una base que no diga «carga» en el nombre. Deja 156 tiendas,
116 productos y unas 2 450 ofertas activas, y las cuentas `carga001`…`carga150` con la clave de
las cuentas de demostración (`CLAVE_DEMO`).

## Escenarios

| Comando | Qué mide |
| --- | --- |
| `node tools/carga/carga.mjs --api=http://localhost:3031 --escenario=visitante --usuarios=50 --segundos=30 --ip-por-pedido` | El techo del servidor sin los límites por IP |
| `CARGA_CLAVE=… node tools/carga/carga.mjs --api=… --escenario=tienda --usuarios=150 --segundos=40 --pausa=1500` | 150 tiendas con sesión, con pausas de persona real |
| `CARGA_CLAVE=… node tools/carga/carga.mjs --api=… --escenario=ingreso --usuarios=20 --segundos=20` | Iniciar sesión (argon2) con muchas personas a la vez |
| `node tools/carga/carga.mjs --api=… --escenario=limites --usuarios=5 --segundos=15` | Una sola IP martillando: tiene que terminar en 429 |

Con `--p95-max=<ms>` y `--errores-max=<0..1>` sale con código 1 si no cumple: sirve para una
revisión automática.

## Resultados del 09/11/2026

**Después de las mejoras de la tarde** (cachés cortas, último mensaje con `DISTINCT ON`, índices; ver [docs/15](../../docs/15-calidad.md)): visitantes con IP por pedido, 50 a la vez → **2 071 pedidos/s**, 0 errores; p95 portada 23 ms, ficha 35 ms, búsqueda 56 ms, categorías 2 ms.

Antes de las mejoras:

En una Mac M-series (API compilada en modo producción, Postgres 16 en Docker, la misma máquina
genera la carga). Un VPS chico puede ser 2 a 4 veces más lento: repetirlo en *staging*.

| Escenario | Resultado |
| --- | --- |
| Visitantes, IP por pedido, 50 a la vez | **741 pedidos/s**, 0 errores. p95: búsqueda 89 ms, portada 80 ms, ficha 60 ms, sugerencias 25 ms |
| 150 tiendas con sesión, pausa 1,5 s | 90 pedidos/s, 0 errores, todas las rutas con p95 ≤ 20 ms salvo el ingreso |
| Las 150 entran a la vez | p50 1,6 s, p95 2,9 s: argon2 hace cola (4 hilos) |
| Ingreso sostenido, 20 a la vez | 55 ingresos/s, p95 493 ms; la API sube a ~500 MB de RAM |
| Una IP sin pausa | 120 respuestas y después 429 (en 3 ms) |
| Sin pausas y con IP fija | Casi todo 429: el límite por persona y ruta (120/min) funciona |

## Catálogo grande (análisis de `docs/16`)

La prueba del 09/11 usaba 116 productos. Para ver cómo escala la búsqueda con un catálogo realista:

```bash
docker exec -i paselibre-local-postgres-1 psql -q -U paselibre -d postgres -c "CREATE DATABASE paselibre_carga"
docker exec paselibre-local-postgres-1 pg_dump -U paselibre paselibre_lienzo | docker exec -i paselibre-local-postgres-1 psql -q -U paselibre -d paselibre_carga
docker exec -i paselibre-local-postgres-1 psql -q -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/catalogo-grande.sql
```

`catalogo-grande.sql` agrega ~60 000 productos y ~180 000 ofertas sintéticas (slug `sint-N`; se puede repetir) y también se niega a correr si la base no dice «carga». Crea todas las ofertas en una sola sentencia, así que todas tienen la **misma fecha**: «Recién publicado» de la portada tiene que ordenar las 180 mil para elegir 16 (~260 ms cada vez). Con `fechas-repartidas.sql` (después del anterior) las fechas quedan repartidas en los últimos 60 días, como en una base de verdad, y la portada baja a ~10 ms:

```bash
docker exec -i paselibre-local-postgres-1 psql -q -U paselibre -d paselibre_carga -v ON_ERROR_STOP=1 < tools/carga/fechas-repartidas.sql
```

Después se arranca la API compilada sobre esa base (como arriba) y:

| Comando | Qué mide |
| --- | --- |
| `node tools/carga/carga.mjs --api=http://localhost:3042 --escenario=visitante --usuarios=50 --segundos=20 --ip-por-pedido` | El techo con catálogo grande |
| Lo mismo con `--variar` | Búsquedas en una página al azar y sugerencias con letras al azar: casi nada sale de la memoria de 30 s de la API (lo peor para la base) |
| `BASE=http://localhost:3042 bash tools/carga/tiempos.sh` | Cada ruta pública, una a la vez (5 repeticiones) |
| `UNICAS=0 k6 run tools/carga/ips.js` y `UNICAS=1 k6 run …` | Memoria de la API con pocas IPs frente a 120 000 IPs distintas (requiere [k6](https://k6.io)) |

**Resultados del 11/11/2026** (API compilada, 60 117 productos, 179 663 ofertas, 50 visitantes, IP por pedido): **53 pedidos/s** (antes 2 071), p95 búsqueda con texto 2 177 ms, por categoría 2 743 ms, ficha 955 ms, portada 617 ms, 0 errores. Postgres a ~980 % de CPU (los 10 núcleos) y la API a 8–26 % de uno: el límite es la base. Una búsqueda sin texto tarda 1,2 s sola. Análisis completo en [docs/16](../../docs/16-seguridad-y-escala.md).

### Resultados del 12/11/2026: arreglo de la búsqueda (rama `nov11/busqueda`)

Misma Mac, API compilada, pool de 15 conexiones, 50 visitantes, IP por pedido, 20 s. El Postgres
de Docker lo comparten otros proyectos locales: las cifras con carga varían ±30 % entre corridas
(del final se dan tres corridas). «Sin texto, sola» es la primera de `tiempos.sh`, que no sale de
la memoria.

**Con el catálogo de docs/16 tal cual** (todas las ofertas con la misma fecha):

| Paso | Pedidos/s | p95 buscar con texto | p95 por categoría | p95 sugerencias | p95 ficha | p95 portada | Sin texto, sola |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Partida (`caafd79`) | 24 | 5 613 ms | 7 064 ms | 1 533 ms | 2 301 ms | 2 164 ms | 2 401 ms |
| 1. Memoria de 30 s para visitantes | 100 | 647 ms | 3 311 ms | 4 ms | 988 ms | 1 274 ms | 2 275 ms |
| 2. Lista y totales en una consulta | 62 | 1 354 ms | 6 068 ms | 194 ms | 1 684 ms | 2 079 ms | 1 519 ms |
| 3. Resumen por producto | 267 | 359 ms | 9 ms | 5 ms | 664 ms | 726 ms | 63 ms |
| 4. `statement_timeout` de 8 s | 167 | 581 ms | 375 ms | 8 ms | 963 ms | 1 369 ms | 55 ms |
| 5. Sin JIT | 233 | 355 ms | 55 ms | 8 ms | 602 ms | 649 ms | 67 ms |
| Final (tres corridas) | 258–363 | 208–331 ms | 3–5 ms | 3–4 ms | 329–574 ms | 415–663 ms | 47–61 ms |

Los pasos 2 y 4 no empeoran nada por sí mismos (en el paso 2 la búsqueda sola baja de 2,3 a 1,5 s;
el 4 no cambia ninguna consulta): son corridas con la máquina más ocupada. Con estos datos el límite
ya no es la búsqueda sino la portada: como las 180 mil ofertas tienen la misma fecha, cada
«Recién publicado» ordena todas (~260 ms de base por pedido) y llena el pool, y la ficha y la
búsqueda (que registra cada pedido en `busqueda`) esperan turno.

**Con las fechas repartidas** (`fechas-repartidas.sql`, como en una base de verdad):

| | Pedidos/s | p95 buscar con texto | p95 por categoría | p95 sugerencias | p95 ficha | p95 portada | CPU Postgres | CPU API |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Partida (`caafd79`) | 43 | 2 961 ms | 3 898 ms | 845 ms | 1 238 ms | 718 ms | ~1 000 % | ~13 % |
| Final (tres corridas) | 1 010–1 799 | 40–88 ms | 6–60 ms | 6–57 ms | 66–151 ms | 49–111 ms | 100–160 % | 100–500 % |
| Final con `--variar` (casi nada sale de la memoria) | 1 711 | 97 ms | 47 ms | 4 ms | 59 ms | 41 ms | ~380 % | — |

Ahora el límite es la API (Node, un núcleo al 100 %), no la base: lo que docs/16 §5 esperaba al
arreglar las consultas. Con `--variar` la partida no cambia (no tenía memoria): 43 pedidos/s.

**Con sesión** (nunca sale de la memoria; Tienda B, fechas repartidas, una a la vez, media de 5):

| | Antes | Ahora |
| --- | ---: | ---: |
| Sin texto | 3 017 ms | 242 ms (equipo: 56 ms) |
| Por categoría | 1 174 ms | 39 ms |
| «ryzen» | 181 ms | 81 ms |
| Sin texto, más barato primero | 3 004 ms | 227 ms |
| Sin texto, con stock (agrupa las ofertas) | 2 901 ms | 544 ms |
| Sugerencias «ryz» | 98 ms | 57 ms |

Con sesión, sin texto, el costo depende de cuántos productos tiene publicados quien mira: para
«Más barato», esos productos se calculan desde las ofertas (la propia va al final). En el catálogo
sintético cada una de las 6 tiendas tiene ~30 000 ofertas, en el 45 % de los productos; una tienda
real tiene cientos.

**Qué cambió** (detalle en los commits de la rama):

1. **Memoria de 30 s** para los resultados y las sugerencias que ve un visitante, por consulta
   normalizada, con una sola consulta en curso por clave y a lo más 500 y 1 000 claves
   (`MemoriaPorClave.recordar`); las facetas del visitante, sin la página (no cambian al pasar de
   página). Con sesión nunca se guarda ni se lee. Cada búsqueda se sigue registrando.
2. **Una sola consulta** para la lista y los totales (`OVER ()`); la foto y la oferta destacada,
   solo para la página.
3. **`producto_resumen`**: una fila por producto con ofertas que ve un visitante (cuántas, stock,
   condiciones, ofertas por galería, la más reciente, los menores precios **visibles**). La
   mantienen triggers por sentencia en `oferta`, `tienda` y `producto`, con un candado por producto
   para que dos publicaciones a la vez no se pisen. Buscar sin texto, por categoría o por texto,
   sin filtros de la oferta (galería, condición, stock, precio) ni tiendas bloqueadas, sale del
   índice por fecha del resumen; las facetas, de una pasada por el resumen. Lo demás sigue
   agrupando las ofertas. Las respuestas son las mismas que antes: 290 de 290 búsquedas iguales
   (visitante, tres tiendas y equipo) entre la API de partida y la nueva sobre esta base.
4. **`statement_timeout` de 8 s y sin JIT** en la conexión de la API (no en las migraciones). El JIT
   de Postgres gastaba ~1,2 s de CPU compilando una búsqueda que se ejecutaba en 0,4 s.

**Lo que falta para ≥ 500 pedidos/s con el catálogo de docs/16 tal cual:** la portada (fuera de
la búsqueda). Con fechas reales ya se pasa con holgura; si se quiere blindar contra ese caso, una
memoria de 30 s para «Recién publicado» del visitante, como la de la búsqueda.
