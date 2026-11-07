# Datos de prueba y verificación automática

Llena PaseLibre con un catálogo realista para ver cómo queda y lo revisa de punta a punta.
Son scripts de Node sin dependencias (Node 22+). Nada de esto se despliega.

| Paso | Comando | Qué hace |
| --- | --- | --- |
| 1 | `pnpm datos:raspar` | Baja marca, modelo, SKU, precio de referencia, especificaciones y una foto de ~100 productos de Infotec (tienda peruana de componentes) a `datos/` |
| 2 | `pnpm datos:cargar` | Publica esos productos por la **API real**, con las cuentas de prueba, y deja Pases del día |
| 3 | `pnpm qa` | Revisa la API y las pantallas y escribe un informe en `informes/` |
| — | `pnpm datos:limpiar` | Elimina las ofertas cargadas (los productos quedan ocultos, sin ofertas vigentes) |

Hacen falta Docker con la base de prueba arriba (`pnpm docker:up`), la API y la web corriendo
(`pnpm dev`) y Chrome para las pantallas (o `CHROME=/ruta/al/chrome`).

## 1. Raspar (`raspar.mjs`)

- Lee el `robots.txt` de la tienda y **no pide nada que prohíba**. Se identifica con un
  User-Agent propio, pide de a uno, espera 1,5 s entre pedidos y guarda todo en `cache/`.
- Solo toma datos (marca, modelo, SKU, precio, especificaciones). **No copia las descripciones
  de marketing**: la carga escribe las suyas.
- Reparte la muestra por precio (de la gama de entrada a la alta) y como mucho 4 productos por
  marca, para que se parezca a una galería de verdad.
- Las fotos se bajan **solo para ver el diseño en local**. Van a `datos/` (fuera de git), no
  son nuestras y no deben publicarse. En producción cada tienda sube las suyas.
- Opciones: `--espera=1500`, `--escala=0.2` (una muestra chica), `--sin-fotos`.
- Todo lo que baja (`cache/`, `datos/`) está en `.gitignore`: el repo es público.

## 2. Cargar (`cargar.mjs`)

- Entra como `tiendaa`, `tiendab`, `tiendac` y `tiendae` (la clave sale de `CLAVE_DEMO` o de
  `apps/api/prisma/semilla.ts`; nunca se imprime).
- Reparte cada producto entre 1 y 3 tiendas con precios, condición (85 % nuevo, 15 % usado),
  stock y moneda distintos. La primera tienda lo crea con su foto; las otras publican «uno igual».
- Deja casos para probar: precios «al interno», ofertas sin stock, pausadas, de distintos días
  (algunas con «Revísala») y las características del producto (esto último y las fechas, directo
  en la base de prueba con `docker exec ... psql`).
- Con `--pases` publica busco y remates de Pases del día (duran pocas horas: vuelve a correrlo
  antes de una demo).
- Es repetible: `datos/cargados.json` recuerda lo cargado, así que no duplica. Con `--semilla=N`
  cambia el reparto al azar. `--solo=3` carga solo 3 productos; `--ver-titulos` muestra cómo
  quedan los títulos sin tocar nada.

## 3. Verificar (`verificar.mjs`)

```bash
pnpm qa                                  # contra la API y la web de siempre (3001 y 3000)
pnpm qa --api=http://localhost:3011/v1 --web=http://localhost:3010
pnpm qa --solo=api                       # sin Chrome
pnpm qa --rapido                         # menos productos y sin tableta
pnpm qa --estres                         # además: 160 visitantes distintos a la vez (¡no en una demo en uso!)
```

`--sin-pausa` salta el minuto de espera entre la API y las pantallas (sirve si corres `--solo=ui`).

**Los límites de la API cuentan por ruta**: 120 pedidos por minuto por persona (sin sesión, por
IP) y 600 por IP, cada uno en cada ruta, y la búsqueda solo 60 (docs/08 §4). La verificación se
frena sola para no tocarlos (un tope por sesión, 50 por minuto en `/buscar` y uno global; si aun
así recibe un 429, espera y repite, y el informe dice cuántos fueron). `--estres` sí los satura a
propósito: manda 160 visitantes con IPs distintas (`X-Forwarded-For`) a la web en ~24 s y exige
que ninguno vea un error. Falla si la web no le reenvía a la API la IP del visitante, porque
entonces todos los visitantes sin sesión comparten el mismo contador (60 búsquedas por minuto
entre todos).

**API** (`qa/api.mjs`): lo que ve un visitante nunca trae tiendas, stands ni precios; el
filtro y el orden por precio no le sirven para deducirlos; la búsqueda encuentra cada producto
por su título, por marca y modelo, sin espacios, en mayúsculas y con errores de tipeo; cada
conteo del lateral coincide con filtrar por él; paginación sin repetidos; cada ficha y cada
foto abren; stock, ofertas y condiciones coinciden con lo que se publicó; los datos inválidos
se rechazan con 400; textos hostiles (SQL, scripts, 5 000 letras, emojis) nunca dan error de
servidor; rendimiento (p95).

**Pantallas** (`qa/ui.mjs`, Chrome sin ventana): cada ruta en celular, tableta y computadora,
como visitante y como tienda. Falla con errores de consola o de hidratación, recursos que
no cargan, desbordes a la derecha, imágenes rotas, `<h1>` distinto de uno, botones o campos sin
nombre, texto como `undefined` o `NaN`. Avisa de imágenes sin `alt`, falta de meta
description, controles chicos para el dedo y cargas lentas. Prueba los flujos: menú de
categorías, buscador, filtros, tarjetas de categoría, sin resultados, ficha, Pases del día, pie
y enlaces internos.

El informe queda en `informes/<fecha>/resumen.md`, con una captura por pantalla en
`capturas/`, y `informes/ultimo.md` es el más reciente. Sale con código 1 si algo falla, así que
sirve en CI. Es de solo lectura, salvo unos POST que la API debe rechazar; **las búsquedas que
hace se borran de «Lo más buscado» al final** (`--sin-limpiar` lo evita).

> Para probar la web sin tocar una demo en marcha, corre una segunda web en otro puerto
> (por ejemplo `next start --port 3010` con `API_INTERNAL_URL` y `NEXT_PUBLIC_TIEMPO_REAL_URL`
> apuntando a una segunda API en el 3011, con `WEB_URL=http://localhost:3010`).
