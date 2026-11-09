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
