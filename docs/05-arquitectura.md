# 05 · Arquitectura

**Versión:** 0.7 (borrador) · **Fecha:** 27/10/2026 · **Responsable:** Dazz

**Decidido el 26/10:** se reutiliza el stack de Yallegó (A-01) y la bandeja de mensajes es **por persona** (A-11). El servidor se elige al final (A-10).

## Cómo leer este documento

Esta es la propuesta técnica para construir la primera salida antes del 31/10. Parte de cuatro fuentes:
- los requerimientos ([02](02-requerimientos-funcionales.md) y [03](03-requerimientos-no-funcionales.md));
- las decisiones del [documento 04](04-decisiones-para-la-reunion.md);
- el **mapa de pantallas y rutas** del [lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A), en la página «Línea final · todas las pantallas»;
- el **modelo de productos y ofertas** (D-43).

- **A-xx** son decisiones de arquitectura. Las que dicen *(por confirmar)* esperan el visto bueno de Dazz o del equipo.
- Los nombres de tablas, rutas y campos están en español, igual que la interfaz. El código (clases, funciones) puede ir en inglés si el equipo lo prefiere, pero los contratos de la API usan estos nombres.

---

## 1. Principios

1. **Llegar al 31/10 con lo que ya conocemos.** Se reutiliza el stack y la forma de desplegar de Yallegó, que Dazz ya opera en producción (RNF-35).
2. **El servidor decide qué ve cada quien.** El precio, la tienda, el stand y el WhatsApp nunca salen hacia quien no tiene sesión, aunque la interfaz los esconda (RNF-18, RNF-50, R-15).
3. **Producto y oferta separados desde el primer día.** Es lo único que no se recorta: cambiarlo después obliga a migrar todo el catálogo (D-43, documento 04).
4. **Una sola API para la web y para la futura app.** Las mismas cuentas, los mismos datos y los mismos contratos (RNF-47).
5. **Postgres primero.** No se suma un servicio nuevo (buscador, cola externa, CDN) hasta que un número lo pida (RNF-34).

## 2. Decisiones de arquitectura

| ID | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- |
| A-01 | **Monorepo pnpm** con `apps/web` (Next.js 15), `apps/api` (NestJS 11), `packages/contracts` (Zod), `packages/ui` (tokens y componentes del lienzo) y `packages/config` | Una sola app Next.js con la API dentro | Es la estructura de Yallegó: se copian la configuración, los Dockerfile y los scripts de despliegue. La app del celular reutiliza la API y los contratos sin tocar la web |
| A-02 | **PostgreSQL 16 + Prisma 6**, con las extensiones `pg_trgm`, `unaccent`, `fuzzystrmatch` y `citext` | Meilisearch o Typesense desde el inicio | Con cientos de tiendas y decenas de miles de ofertas (RNF-28), Postgres resuelve la búsqueda tolerante en menos de 1 s. Un buscador aparte es otro servicio que sincronizar y respaldar. Criterio para cambiar en la sección 7 |
| A-03 | **Redis 7** para el adaptador de socket.io, los límites de peticiones y las colas (BullMQ) | Sin Redis | Ya está en el stack. Hace falta para el tiempo real con más de un proceso y para procesar fotos sin frenar la API |
| A-04 | **Tiempo real con socket.io** sobre la misma API, con el adaptador de Redis | Consultar cada pocos segundos (*polling*) | Cumple RNF-48 (menos de 5 s) y ya se usa en Yallegó. Si el socket se cae, la interfaz vuelve a pedir lo pendiente al reconectar |
| A-05 | **Sesión con cookie** `httpOnly` y un token opaco guardado como *hash* en la tabla `sesion`. Contraseñas con **argon2id**. La app usará el mismo token como `Bearer` | JWT sin estado | Suspender una cuenta corta la sesión al instante. Deja lista la lista de sesiones abiertas de la fase 2 (RF-67) |
| A-06 | **Respuestas por audiencia:** cada recurso tiene un contrato para visitante, otro para vendedor y otro para el dueño de la oferta. Las consultas de visitante **no seleccionan** las columnas de precio ni de tienda | Filtrar en la interfaz | Es la única forma de garantizar RNF-18 y RNF-50. Una prueba automática revisa que el JSON público no traiga esos campos |
| A-07 | **WhatsApp a pedido:** el número no viaja en la página. El botón llama a `POST /v1/ofertas/:id/contacto` y la API devuelve el enlace `wa.me` con el mensaje armado | Poner el enlace en el HTML | Protege los números del *scraping* (RNF-19), registra el clic (RF-23) y deja fuera al visitante (RNF-50) |
| A-08 | **Fotos:** se suben a la API, que valida tipo y tamaño, quita los metadatos (EXIF) y genera WebP en 3 tamaños con `sharp`. Se guardan detrás de una interfaz `Almacen`, con disco local en el MVP y copia nocturna a Backblaze B2 | Subir directo a un *bucket* desde el navegador | Menos piezas para el 31/10 y sin costo extra. Pasar a R2 o B2 después es cambiar el adaptador, no el código |
| A-09 | **Next.js renderiza en el servidor** las páginas públicas (portada, búsqueda y ficha) para que los buscadores las indexen (RNF-42). Como nunca llevan datos privados, se pueden cachear. Las páginas con sesión responden `no-store` | Todo en el navegador | SEO, carga rápida en 4G (RNF-10) y ningún riesgo de que una caché sirva un precio a un visitante |
| A-10 | **Docker Compose en un VPS** con nginx, Let's Encrypt, y entornos de *staging* y producción. *Se decide al final si es un VPS nuevo o el de Yallegó*; el mismo `compose.yml` sirve para los dos | Vercel + base administrada | Costo fijo y bajo (RNF-34), el mismo flujo de despliegue que Yallegó y sin límites de WebSocket |
| A-11 | **Bandeja de mensajes por persona.** Cada hilo es entre dos personas: quien escribe y el **responsable** de la oferta, que es quien la publicó. Los demás usuarios de la tienda no lo ven | Bandeja compartida por tienda | Decisión de Dazz (26/10). Cada asesor responde lo suyo. Para que no queden hilos sin dueño, el equipo puede cambiar el responsable de una oferta y de sus hilos (sección 8) |

## 3. Vista general

```mermaid
flowchart LR
  subgraph Usuarios
    V[Visitante]
    S[Vendedor con sesión]
    E[Equipo de PaseLibre]
  end
  N[nginx + TLS]
  W["apps/web · Next.js<br/>páginas y SEO"]
  A["apps/api · NestJS<br/>REST /v1 + socket.io"]
  Q[["Trabajos en cola<br/>(fotos, avisos)"]]
  P[(PostgreSQL 16)]
  R[(Redis 7)]
  F[(Almacén de fotos<br/>disco + copia B2)]
  WA([WhatsApp])

  V & S & E --> N
  N -->|páginas| W
  N -->|/v1 y /tiempo-real| A
  N -->|/media| F
  W -->|"lee con la cookie del usuario"| A
  A --> P
  A --> R
  A --> Q --> F
  S -.->|enlace wa.me que entrega la API| WA
```

| Pieza | Qué hace | Qué no hace |
| --- | --- | --- |
| **nginx** | TLS, compresión, sirve `/media` con caché larga, pasa `/v1` y el WebSocket a la API y el resto a la web | No guarda en caché nada con cookie de sesión |
| **Web (Next.js)** | Pantallas del lienzo, SEO, formularios. En el servidor llama a la API con la cookie del usuario | No habla con la base de datos ni decide permisos |
| **API (NestJS)** | Reglas de negocio, permisos, contratos por audiencia, búsqueda, chat en tiempo real y avisos | No arma HTML |
| **Cola (BullMQ en la API)** | Procesa fotos y, en la fase 2, el aviso por correo | |
| **PostgreSQL** | Datos, búsqueda tolerante y métricas de uso | |
| **Redis** | socket.io entre procesos, límites de peticiones, colas | No guarda datos que no se puedan perder |

## 4. Modelo de datos

### 4.1 La idea central: producto y oferta

- Un **producto** es el modelo que existe en el mercado, una sola vez en el catálogo. Por ejemplo, «MSI GeForce RTX 3070 Ventus 3X OC 8 GB», con su categoría, marca, fotos base, etiquetas y características.
- Una **oferta** es lo que una tienda tiene de ese producto: condición (nuevo o usado), stock, precio, moneda, si el precio es visible y una descripción propia. La ficha del producto lista sus ofertas, de menor a mayor precio.
- **«Publicar uno igual»** crea una oferta sobre un producto que ya existe; no copia el producto.
- Un **producto nuevo** lo crea el vendedor cuando no lo encuentra. El equipo une los duplicados (RF-54).

```mermaid
erDiagram
  GALERIA ||--o{ TIENDA : "agrupa"
  TIENDA ||--o{ USUARIO : "tiene"
  CATEGORIA ||--o{ PRODUCTO : "clasifica"
  MARCA ||--o{ PRODUCTO : "fabrica"
  PRODUCTO ||--o{ PRODUCTO_FOTO : "fotos base"
  PRODUCTO }o--o{ ETIQUETA : "producto_etiqueta"
  PRODUCTO ||--o{ OFERTA : "se ofrece en"
  TIENDA ||--o{ OFERTA : "publica"
  OFERTA ||--o{ OFERTA_FOTO : "fotos propias"
  OFERTA ||--o{ CONVERSACION : "se consulta en"
  USUARIO ||--o{ CONVERSACION : "escribe o responde"
  USUARIO ||--o{ OFERTA : "es responsable de"
  CONVERSACION ||--o{ MENSAJE : "contiene"
  OFERTA ||--o{ VENTA : "«Vendido»"
  USUARIO ||--o{ AVISO : "recibe"
  USUARIO ||--o{ SESION : "abre"

  PRODUCTO {
    uuid id PK
    uuid categoria_id FK
    uuid marca_id FK
    text titulo
    text modelo
    citext slug UK
    jsonb caracteristicas
    text texto_busqueda "normalizado, índice trigram"
    uuid fusionado_en_id FK "si se unió a otro"
  }
  OFERTA {
    uuid id PK
    uuid producto_id FK
    uuid tienda_id FK
    uuid responsable_id FK "quien la publicó"
    enum condicion "NUEVO, USADO"
    int stock "mayor o igual a 0"
    bigint precio_centimos "puede ser nulo"
    enum moneda "USD, PEN"
    bool precio_visible "falso por defecto"
    enum estado "ACTIVA, PAUSADA, ELIMINADA"
    timestamptz actualizada_en
  }
  TIENDA {
    uuid id PK
    enum tipo "TIENDA, INDEPENDIENTE"
    text nombre
    uuid galeria_id FK "nulo si es independiente"
    text stand
    text whatsapp
    bool precio_visible_defecto
    enum moneda_defecto
  }
```

### 4.2 Tablas de la primera salida

| Tabla | Para qué | Columnas clave y reglas |
| --- | --- | --- |
| `galeria` | Maxiplaza, Cyberplaza y las que vengan (RNF-29) | `nombre`, `slug`, `activa` |
| `tienda` | Quien vende: tienda o independiente | `tipo`, `nombre`, `galeria_id` (nulo para independientes), `stand`, `whatsapp`, `horario`, `descripcion`, `logo`, `precio_visible_defecto` (falso), `moneda_defecto` (USD), `estado` (ACTIVA, SUSPENDIDA). `perfil_privado` queda creada para la fase 2 |
| `usuario` | Personas que entran | `tienda_id` (nulo para el equipo), `rol` (DUENO, ASESOR, EQUIPO), `usuario` (citext único), `correo` (citext único, opcional), `nombre`, `clave_hash` (argon2id), `debe_cambiar_clave`, `primer_ingreso_en`, `estado` (ACTIVO, SUSPENDIDO), preferencias de «No molestar» |
| `sesion` | Sesiones abiertas | `usuario_id`, `token_hash`, `expira_en`, `revocada_en`, `agente`, `ip` |
| `categoria` | Las 7 categorías iniciales (RF-11), ampliables sin código (RNF-27) | `nombre`, `slug`, `orden`, `padre_id` |
| `marca` | Para el filtro por marca | `nombre`, `slug` |
| `producto` | Catálogo único | Ver diagrama. `texto_busqueda` se recalcula con un *trigger* a partir del título, la marca, el modelo y las etiquetas |
| `producto_foto` | Fotos base | `orden`, `ruta`, `ancho`, `alto` |
| `etiqueta` + `producto_etiqueta` | Etiquetas (RF-07) | `nombre` y `clave` normalizada única: «RTX3070», «rtx 3070» y «RTX-3070» dan la misma clave `rtx 3070` (RNF-26) |
| `oferta` | Lo que publica cada tienda | Ver diagrama. `responsable_id` es el usuario que recibe los mensajes de esa oferta. Única por (`producto_id`, `tienda_id`, `condicion`) mientras no esté eliminada. Borrar es `estado = ELIMINADA`, para conservar las conversaciones |
| `oferta_foto` | Fotos propias, opcionales | Hasta 8 por oferta |
| `archivo` | Fotos subidas que todavía no se usan | `usuario_id`, `tienda_id`, `ruta` (única), `ancho`, `alto`, `bytes`, `usado_en`. Una foto solo la usa alguien de la misma tienda y una sola vez; las que nunca se usan se podrán limpiar con una tarea nocturna |
| `conversacion` | Un hilo por oferta y persona que pregunta | `oferta_id`, `comprador_id` y `vendedor_id` (usuarios), las tiendas de cada uno, `ultimo_mensaje_en`. Única por (`oferta_id`, `comprador_id`) |
| `participacion` | Estado de cada persona en el hilo | `conversacion_id`, `usuario_id`, `archivada`, `silenciada`, `no_leida_manual`, `leido_hasta` (para el «Visto») |
| `mensaje` | Texto, foto o aviso del sistema | `autor_usuario_id`, `tipo` (TEXTO, FOTO, SISTEMA), `texto`, `foto` |
| `respuesta_rapida` | Editables en Configuración (RF-56) | `usuario_id`, `texto`, `orden` |
| `bloqueo` | Quién bloqueó a quién (RF-57) | `usuario_id` (quien bloquea) y `tienda_bloqueada_id`: se bloquea a la tienda entera para que no vuelva a escribir desde otra cuenta |
| `denuncia` | Para moderación (RNF-53) | `denunciante_id`, `objeto` (OFERTA, CONVERSACION, TIENDA), `objeto_id`, `motivo`, `estado` |
| `venta` | Cada «Vendido» (RF-47) | `oferta_id`, `comprador_id`, `tienda_compradora_id`, `conversacion_id`, `stock_antes`, `stock_despues`, `registrada_por` |
| `aviso` | La campanita (RF-40) | `usuario_id`, `tipo`, `titulo`, `extracto`, `enlace`, `visible_desde` (para «No molestar»), `leido_en`. Un aviso por conversación con mensajes sin leer: se actualiza, no se apila |
| `preferencia_aviso` | Configuración · Avisos (RF-59) | `usuario_id`, `tipo`, `campanita`. La columna `correo` llega con RF-42 |
| `busqueda` | Métricas y búsquedas sin resultados (RF-31, RF-32) | `texto`, `texto_corregido`, `resultados`, `usuario_id`, `creada_en` |
| `contacto` | Clics en «Enviar mensaje» y «WhatsApp» (RF-23) | `oferta_id`, `usuario_id`, `canal`, `creado_en` |
| `auditoria` | Acciones del equipo: crear cuenta, nueva clave, suspender, unir productos | `actor_id`, `accion`, `objeto`, `datos` |

### 4.3 Reglas que cuida la base de datos

- **Dinero en enteros:** `precio_centimos` (US$ 250 → 25000) y `moneda`; nunca decimales flotantes. Si no hay precio, se muestra «Al interno».
- **Stock nunca negativo** (`CHECK stock >= 0`). «Sin stock» se deriva de `stock = 0`, no es otro estado.
- **`actualizada_en`** cambia con cualquier cambio de stock, precio o visibilidad, y con «Siguen igual». De ahí salen la fecha que se muestra (RF-09) y el aviso de los 7 días (RF-10).
- **Unir productos** mueve las ofertas al producto que se queda, marca el otro con `fusionado_en_id` y su dirección vieja redirige con 301.
- **Valores por defecto de la tienda:** al publicar, la oferta toma `precio_visible_defecto` y `moneda_defecto`, y el vendedor puede cambiarlos (D-37).
- **Fase 2 prevista, no construida:** `pedido_pase`, `pregunta`, `favorito`, `seguimiento`, `precio_rol` y `perfil_privado` se agregan con migraciones aditivas, sin tocar las tablas de arriba.

## 5. Quién ve qué

| Dato | Visitante | Vendedor con sesión | Dueño de la oferta | Equipo |
| --- | --- | --- | --- | --- |
| Producto, fotos, etiquetas, características | Sí | Sí | Sí | Sí |
| Condición, stock, galería, fecha de actualización | Sí | Sí | Sí | Sí |
| Nombre de la tienda y stand | **No** («Tienda de Maxiplaza») | Sí | Sí | Sí |
| Precio visible | **No** («Precio con sesión») | Sí | Sí | Sí |
| Precio oculto | **No** | **No** («Al interno · consultar») | Sí | Sí |
| WhatsApp | **No** | Solo al pulsar el botón (A-07) | Sí | Sí |
| Mensajes | **No** | Solo los suyos | Solo los suyos (es el responsable) | **No** (RNF-44) |

**Cómo se garantiza:**
- Cada audiencia tiene su propio `select` de Prisma y su propio contrato Zod (`OfertaPublica`, `OfertaVendedor`, `OfertaPropia`).
- La prueba `contrato-publico.spec` pide como visitante la portada, la búsqueda y la ficha, y falla si el JSON contiene `precio`, `tienda`, `stand` o `whatsapp`.
- La API responde `Cache-Control: private, no-store` a toda petición con sesión. nginx no cachea respuestas que lleven cookie.
- **Tampoco se deja deducir el precio:**
  - Para el visitante, las ofertas de la ficha van por fecha, no por precio.
  - Al visitante se le ignoran el filtro y el orden por precio de la búsqueda; si no, podría adivinar precios probando rangos.
- **Clave temporal:** quien todavía no creó su contraseña ve el catálogo como visitante, para que nadie vea precios con una clave que conoce el equipo.

## 6. Rutas de la web y de la API

### 6.1 Rutas de la web (las del mapa del lienzo)

| Ruta | Pantalla en el lienzo | Quién | Cómo se arma | Llama a |
| --- | --- | --- | --- | --- |
| `/` | Portada (visitante) / Inicio con sesión | Todos | Servidor; con caché solo sin sesión | `GET /v1/portada` |
| `/buscar?q=&categoria=&galeria=&marca=&condicion=&stock=&orden=` | Resultados | Todos | Servidor | `GET /v1/buscar` |
| `/c/:categoria` | Resultados con la categoría puesta | Todos | Servidor | `GET /v1/buscar` |
| `/p/:producto` y `?oferta=:id` | Ficha | Todos | Servidor | `GET /v1/productos/:slug` |
| `/ingresar` | Acceso y primer ingreso | Sin sesión | Cliente | `POST /v1/sesion`, `POST /v1/sesion/clave` |
| `/publicar`, `?igual=:producto` y `?editar=:oferta` | Publicar uno igual (y editar una oferta) | Vendedor | Cliente | `GET /v1/catalogo/sugerencias`, `POST /v1/archivos`, `POST /v1/ofertas`, `GET` y `PATCH /v1/ofertas/:id` |
| `/mis-publicaciones` | Mis publicaciones | Vendedor | Cliente | `GET /v1/mis-ofertas`, `PATCH` y `DELETE /v1/ofertas/:id`, `POST /v1/ofertas/confirmar` |
| `/mensajes` y `/mensajes/:conversacion` | Mensajes (página C) | Vendedor | Cliente + tiempo real | `/v1/conversaciones…` |
| `/cuenta/configuracion` | Configuración (página C) | Vendedor | Cliente | `/v1/cuenta…` |
| `/equipo/cuentas`, `/equipo/carga`, `/equipo/catalogo` | Panel del equipo | Equipo | Cliente | `/v1/equipo…` |

Las rutas de la fase 2 (`/cuenta`, `/t/:tienda`, `/notificaciones`, `/bandeja`) ya tienen nombre en el mapa para no chocar después.

### 6.2 API `/v1`

| Grupo | Método y ruta | Qué hace | RF |
| --- | --- | --- | --- |
| Público | `GET /portada?galeria=` | Recién publicado y conteos por categoría | 44 |
| | `GET /buscar` | Productos con resumen de sus ofertas, facetas y corrección («Buscaste…») | 12–18 |
| | `GET /productos/:slug` | Producto y sus ofertas, según la audiencia | 19, 52 |
| | `GET /categorias`, `GET /galerias` | Listas para menús y filtros | 11, 17 |
| Sesión | `POST /sesion` | Ingresar con usuario o correo | 02 |
| | `DELETE /sesion` | Salir | |
| | `POST /sesion/clave` | Primer ingreso o cambio de contraseña | 50, 60 |
| | `GET /yo` | Usuario y tienda, con sus valores por defecto al publicar | |
| Vendedor | `GET /catalogo/sugerencias?q=` o `?producto=` | «Ya está en PaseLibre» al publicar, con la misma búsqueda tolerante; con `producto`, uno solo para «Publicar uno igual» desde la ficha | 53 |
| | `POST /ofertas` | Publicar: «uno igual» con `producto_id`, o producto nuevo con `producto_nuevo`. El producto y la oferta se crean en una sola transacción, para que no queden productos sin oferta | 05, 06, 38 |
| | `GET /ofertas/:id` | Una oferta propia, para editarla | 08 |
| | `GET /mis-ofertas?estado=&q=` | Activas, sin stock, pausadas | 08 |
| | `PATCH /ofertas/:id` | Stock, precio, visibilidad, pausar o reactivar | 06, 08, 09 |
| | `DELETE /ofertas/:id` | Eliminar (lógico) | 08 |
| | `POST /ofertas/confirmar` | «Siguen igual» para las de más de 7 días | 10 |
| | `POST /ofertas/:id/contacto` | Abre conversación o devuelve el enlace de WhatsApp, y registra el clic. No se contacta a la propia tienda ni a quien te bloqueó | 21, 23 |
| | `GET /ofertas/:id/interesados` | Quiénes escribieron por esa oferta en los hilos de quien vende, para «Vendido» | 47 |
| | `POST /ofertas/:id/vendido` | Descuenta 1 de stock y deja el aviso en el chat | 47 |
| | `POST /archivos` | Subir una foto (campo `foto`, multipart). Devuelve la ruta para usarla en una oferta, un producto o el chat | 05, 39 |
| Mensajes | `GET /conversaciones?filtro=&q=` | Lista con filtros y buscador | 55 |
| | `GET /conversaciones/:id/mensajes?antes=` | Historial por páginas | 39 |
| | `POST /conversaciones/:id/mensajes` | Enviar texto o foto | 39 |
| | `PATCH /conversaciones/:id` | Leer, no leída, silenciar, archivar | 57 |
| | `GET /conversaciones/:id` | El hilo con el producto fijo arriba, si el otro está activo y si se puede marcar «Vendido» | 55, 47 |
| | `POST` y `DELETE /conversaciones/:id/bloqueo`, `POST /denuncias` | Bloquear, desbloquear y denunciar | 57 |
| | `GET /avisos`, `POST /avisos/leidos` | Campanita | 40 |
| | `GET /contadores` | Las insignias de Mensajes y de la campanita | 40, 55 |
| Cuenta | `GET/PATCH /cuenta` | Datos de la persona y de la tienda, logo, «Visto» y valores por defecto al publicar. Usuario, galería y stand solo los cambia el equipo | 48, 57, 58 |
| | `GET/PUT /cuenta/avisos` | Campanita por tipo de aviso y «No molestar» (hora de Lima) | 59 |
| | `GET/PUT /cuenta/respuestas-rapidas` | Respuestas rápidas: hasta 8, en orden y sin repetir | 56 |
| | `GET /cuenta/sesiones`, `DELETE /cuenta/sesiones/:id`, `POST /cuenta/sesiones/cerrar-otras` | Sesiones abiertas, por navegador | 60 |
| | `GET /cuenta/bloqueados`, `DELETE /cuenta/bloqueados/:tienda` | Tiendas bloqueadas, para desbloquearlas | 57 |
| Equipo | `GET/POST /equipo/cuentas` | Listar y crear cuentas con clave temporal | 35, 49 |
| | `POST /equipo/cuentas/:id/clave-temporal` | Nueva clave; obliga a cambiarla al entrar | 50 |
| | `PATCH /equipo/cuentas/:id` | Suspender o reactivar | 28 |
| | `POST /equipo/cuentas/:id/traspasar` | Pasar publicaciones e hilos a otra cuenta activa de la misma tienda. La lista (`GET /equipo/cuentas`, también `?tienda=`) muestra qué tiene cada cuenta a su nombre | 71 |
| | `GET /equipo/tiendas` | Tiendas activas, para elegir la de un asesor | 35 |
| | `POST /equipo/cargas`, `POST /equipo/cargas/:id/confirmar` | Carga por planilla con vista previa | 34 |
| | `GET /equipo/duplicados`, `POST /equipo/productos/:id/unir` | Unir productos | 54 |
| Operación | `GET /salud` | Estado de la API, la base y Redis | RNF-39 |

**Errores:** todos con la forma `{ "error": { "codigo": "OFERTA_NO_ENCONTRADA", "mensaje": "…", "detalles": [...] } }`. Los mensajes van en español para mostrarlos tal cual.

### 6.3 Tiempo real

El navegador abre un socket en `/tiempo-real` con su cookie. La API lo une a la sala de su usuario (`usuario:<id>`), por donde llegan sus mensajes y avisos, a la de su tienda (`tienda:<id>`), por donde llegan los cambios de stock, y a la de su sesión (`sesion:<id>`).

- **Quién entra:** solo una sesión vigente con contraseña propia. El handshake revisa además el origen: CORS no protege a un WebSocket, y sin esto otro sitio podría abrir el socket con la cookie del vendedor.
- **Cortes:** al salir se cortan los sockets de esa sesión; al suspender una cuenta o darle una clave nueva, todos los suyos.
- **En local** la web se conecta directo a la API (`localhost:3001`), porque el rewrite de Next no pasa WebSockets; en producción va por el mismo dominio y nginx hace el `upgrade`.
- **Presencia** («Activo ahora»): se lleva en memoria y alcanza con un solo proceso de API. Si se escala a varios, hace falta el adaptador de Redis. Al conectarse y al desconectarse se guarda `usuario.ultima_conexion_en` para «Activo hace 2 h».

| Evento | Va a | Para qué |
| --- | --- | --- |
| `tiempo-real:listo` | El socket que entra | Ya está en sus salas: desde aquí no se pierde nada |
| `mensaje:nuevo` | Las dos personas del hilo | Pintar el mensaje y subir el contador |
| `mensaje:visto` | La persona que escribió | «Visto», si el otro lado no lo desactivó |
| `aviso:nuevo` | El usuario | Campanita |
| `oferta:stock` | La tienda dueña | Refrescar Mis publicaciones tras un «Vendido» |
| `contadores:cambio` | El usuario | Se leyó algo en otra pestaña: volver a pedir las insignias |

Al reconectar, la interfaz vuelve a pedir la lista, la conversación abierta y los contadores. No se pierde nada si el socket se cae.

## 7. Búsqueda tolerante a errores

**Objetivo:** «rtx 3370» encuentra la RTX 3070 y lo dice (RF-13, RF-14) en menos de 1 s (RNF-08).

1. **Normalizar** la consulta: minúsculas, sin tildes, separar letras de números («rtx3070» → «rtx 3070»), espacios simples. Las etiquetas y `producto.texto_busqueda` se guardan con la misma normalización.
2. **Buscar tal cual:** productos cuyo `texto_busqueda` contiene todas las palabras. Usa un índice GIN `gin_trgm_ops`.
3. **Si hay pocos resultados, corregir palabra por palabra** contra la tabla `termino`, que tiene las palabras conocidas del catálogo:
   - Para las palabras con números se usa la distancia de Levenshtein (`fuzzystrmatch`) con tope 1: «3370» → «3070». La similitud por trigramas falla con números cortos.
   - Para las palabras con letras se usa `similarity()` de `pg_trgm` con un mínimo de 0,4: «ventsu» → «ventus».
4. **Volver a buscar** con la consulta corregida y responder `{ "correccion": { "buscaste": "rtx 3370", "mostramos": "rtx 3070" } }`.
5. **Agrupar por producto:** cuántas ofertas tiene, en qué galerías, stock total, si hay nuevos o usados y, solo con sesión, el menor precio visible.
6. **Facetas** (galería, marca, condición, stock) con conteos, y **ordenar** por más recientes o por precio. El orden por precio solo se ofrece con sesión.
   - **Monedas:** no hay tipo de cambio, así que no se mezclan. El orden por precio va primero por el menor precio visible en dólares y después en soles.
   - **Filtro de precio:** se aplica a los precios visibles en la moneda elegida. Las ofertas al interno siempre se muestran, como dice el lienzo.
7. **Registrar** la búsqueda en `busqueda`, incluidas las que no tuvieron resultados (RF-32).

**Cuándo pasar a un buscador dedicado:** si con más de 50 000 ofertas la búsqueda supera 1 s en el 95 % de los casos, o si hacen falta sinónimos y orden por relevancia más finos. Entonces se suma Meilisearch, alimentado desde la cola, sin cambiar el contrato de `/v1/buscar`.

## 8. Mensajes, «Vendido» y campanita

- **Un hilo por oferta y por persona que pregunta.** «Enviar mensaje» desde la ficha abre el hilo existente o crea uno nuevo con el responsable de la oferta, con el producto fijo arriba.
- **Bandeja por persona (A-11).** El hilo es entre quien escribe y el responsable de la oferta. El dueño no ve los hilos de sus asesores ni al revés.
- **Hilos sin dueño:** si un asesor deja la tienda o su cuenta se suspende, el equipo pasa sus publicaciones y sus hilos a otra cuenta activa de la misma tienda (`POST /equipo/cuentas/:id/traspasar`), en una transacción y con registro en `auditoria`. En la fase 2 lo hará el dueño desde Mis publicaciones.
  - Pasan las publicaciones no eliminadas y los hilos donde era el vendedor, con su estado de lectura y su aviso de la campanita.
  - Los hilos donde preguntó como comprador también pasan, salvo que la cuenta que recibe ya tenga uno por la misma publicación (un hilo por publicación y persona). Esos quedan donde estaban y el panel lo avisa.
  - Los bloqueos son de la persona: no se traspasan.
- **Bloqueo:** quien bloquea, bloquea a la tienda entera. Antes de guardar un mensaje, la API revisa la tabla `bloqueo`; el bloqueado recibe el error `BLOQUEADO` y no se le avisa al otro.
- **Fotos en el chat:** se suben con `POST /archivos` y el mensaje lleva la referencia. Una foto por mensaje (con texto opcional) y nada de archivos (D-30).
- **La lista** solo muestra hilos con al menos un mensaje: abrir el chat desde la ficha y no escribir no le llena la bandeja a nadie. Un mensaje nuevo saca el hilo de Archivados.
- **La campanita** tiene un aviso por conversación: «Tienes 2 mensajes sin leer de Tienda C», con el último mensaje como extracto. Si el hilo está silenciado o la persona apagó los avisos de mensajes no hay aviso, pero el chat se actualiza igual. Con «No molestar» (hora de Lima, también de noche a la mañana), el aviso aparece al terminar el horario.
- **Desde la ficha:** «Enviar mensaje» es un enlace a `/mensajes?oferta=<id>`, que abre el hilo y lleva a él.

```mermaid
sequenceDiagram
  participant B as Carla · Tienda B
  participant API as API
  participant DB as PostgreSQL
  participant A as Luis · Tienda A (responsable)
  B->>API: POST /conversaciones/:id/mensajes
  API->>DB: guarda el mensaje y actualiza el aviso de Luis (una transacción)
  API-->>B: 201 mensaje
  API-)A: mensaje:nuevo y aviso:nuevo (si está conectado)
  Note over A: Si no está conectado, ve el contador al volver.<br/>Con «No molestar», el aviso queda con visible_desde al final del horario.
```

**«Vendido» (RF-47):** se hace en una sola transacción.
1. Se bloquea la fila de la oferta.
2. Se valida que `stock > 0`.
3. Se resta 1 y se inserta la `venta` con el stock antes y después.
4. Se agrega un mensaje `SISTEMA` al hilo («1 unidad vendida a Tienda B · stock 2 → 1») y se emite `oferta:stock`.

Solo se vende a alguien que escribió por esa oferta en un hilo de quien vende.

Así, dos «Vendido» al mismo tiempo no dejan el stock en negativo. Si se recorta (documento 04, recorte 1), el vendedor usa el − de Mis publicaciones, que llama al mismo `PATCH`.

**Privacidad (RNF-44):** el panel del equipo no tiene ninguna ruta para leer conversaciones. Una denuncia guarda el motivo y el identificador del hilo; si el equipo necesita ver mensajes, se los pide a quien denunció.

## 9. Cuentas, sesiones y seguridad

| Rol | Puede |
| --- | --- |
| Visitante | Ver y buscar el catálogo público |
| Dueño, asesor e independiente | Lo anterior, más ver precios y tiendas, contactar, publicar, gestionar las ofertas de **su** tienda, **sus** mensajes y su configuración |
| Equipo | Panel del equipo. No ve mensajes |

En el MVP el dueño y el asesor pueden lo mismo dentro de su tienda. La diferencia (el dueño crea asesores, con límite por plan) llega con RF-36.

- **Ingreso:** usuario o correo (sin distinguir mayúsculas) y contraseña.
  - La clave temporal que entrega el equipo marca `debe_cambiar_clave` y el primer ingreso obliga a cambiarla (pantalla «Crea tu contraseña» del lienzo).
  - Reglas: al menos 8 caracteres y un número.
- **Sesión:**
  - Dura 12 horas, o 30 días renovables con «Mantener la sesión».
  - La cookie va con `Secure`, `HttpOnly` y `SameSite=Lax`, y las peticiones que cambian datos exigen además la cabecera `X-PaseLibre`, como defensa contra CSRF.
  - Suspender una cuenta revoca todas sus sesiones.
- **Límites (RNF-19).** En una galería muchas tiendas salen a internet con la misma IP, así que cada petición pasa por dos contadores (`apps/api/src/shared/limites.ts`):
  - Por IP, un techo alto: 600 por minuto.
  - Por persona: 120 por minuto, contado por su sesión, o por IP si no tiene sesión.
  - Los límites de cada ruta:

    | Ruta | Límite | Se cuenta por |
    | --- | --- | --- |
    | Ingreso | 5 intentos fallidos cada 15 minutos | Cuenta |
    | Ingreso | 60 intentos cada 15 minutos | IP |
    | Cambio de contraseña | 10 cada 15 minutos | Persona |
    | Búsqueda | 60 por minuto | Persona (sin sesión, IP) |
    | Contactar, que da el WhatsApp | 30 por minuto | Persona |
    | Mensajes | 30 por minuto | Persona |
    | Subidas | 30 por hora | Persona |
    | Denuncias | 10 por hora | Persona |

  - *Cambio del 27/10:* antes había un único límite general de 120 por minuto por IP y el ingreso permitía 20 por IP; el día del piloto toda una galería con el mismo wifi se hubiera frenado entre sí. El contador por cuenta sigue frenando a quien prueba claves.
- **Entradas:** todo cuerpo y consulta pasa por su esquema Zod. El texto del chat y de las descripciones se guarda plano y se escapa al pintarlo; no se acepta HTML.
- **Fotos (RNF-20):**
  - Solo JPEG, PNG o WebP, hasta 8 MB, revisando el contenido y no solo la extensión.
  - Cada foto se vuelve a guardar en WebP, enderezada y con el lado mayor en 1600 px como máximo. Así se quitan los metadatos EXIF, que pueden traer la ubicación.
  - Se guardan en `MEDIA_DIR` con un nombre único (`2026/10/<uuid>.webp`) y se sirven en `/media`, con caché larga.
  - El límite de 30 subidas por hora se cuenta por persona y no por IP: en una galería muchas tiendas comparten la misma IP.
- **Permisos (RNF-17):** cada ruta de vendedor comprueba que la oferta, el hilo o la tienda sean de la tienda de la sesión. Las rutas del equipo exigen `rol = EQUIPO`.
- **Datos personales (RNF-21 a 24):**
  - El WhatsApp se pide con consentimiento al crear la cuenta.
  - Hay un procedimiento para borrar una cuenta a pedido: anonimiza al usuario, elimina las ofertas y conserva las ventas sin datos personales.
- **Cabeceras:** CSP, HSTS, `X-Content-Type-Options` y `Referrer-Policy`, como en Yallegó.

## 10. Infraestructura, despliegue y operación

- **Servicios** (un `compose.yml` por entorno): `web`, `api` (con la cola de BullMQ dentro), `migraciones` (corre y termina), `postgres:16-alpine` y `redis:7-alpine`. nginx del host con Let's Encrypt. Las fotos van en un volumen que la API escribe y nginx sirve en `/media`.
- **Entornos:** *staging* y producción, con bases separadas (RNF-33). El despliegue sigue el patrón de Yallegó:
  1. Construir las imágenes.
  2. Respaldar la base.
  3. Correr las migraciones.
  4. Cambiar las imágenes en el `.env`.
  5. Hacer una prueba de humo.
- **Respaldos (RNF-13):** ver [`tools/deploy/RESPALDOS.md`](../tools/deploy/RESPALDOS.md).
  - `pg_dump` cada noche, con 7 diarios y 4 semanales, validado antes de publicarse.
  - Los respaldos y las fotos se copian a B2 con `rclone`.
  - Los domingos, un ensayo restaura el último respaldo en una base aparte, lo compara y revisa que existan las fotos.
  - Antes de salir se prueba una restauración completa en *staging*.
- **Observabilidad (RNF-38, RNF-39):**
  - Logs JSON con pino.
  - `GET /v1/salud`, revisada desde afuera cada minuto por un monitor gratuito que avisa por correo.
  - Los reportes de uso (RF-31) son consultas SQL sobre `busqueda`, `contacto` y `oferta`.
- **Costo (RNF-34):** un VPS de 2 vCPU y 4 GB alcanza para la primera salida. El costo mensual es del orden de un VPS chico más centavos de B2; el dominio va aparte *(por confirmar: VPS y dominio)*.

## 11. Estructura del código y reparto

```text
paselibre/
├─ apps/
│  ├─ web/                 Next.js · pantallas del lienzo
│  │  └─ src/features/     catalogo · ficha · acceso · publicar · mis-publicaciones · mensajes · configuracion · equipo
│  └─ api/                 NestJS
│     ├─ prisma/           esquema, migraciones y semilla (categorías, galerías, productos del piloto)
│     └─ src/modules/      sesion · catalogo · busqueda · ofertas · mensajes · avisos · cuenta · equipo · archivos
├─ packages/
│  ├─ contracts/           esquemas Zod compartidos por web, API y la futura app
│  ├─ ui/                  tokens de la línea Hielo (Figtree 400/500/600, azul noche, azul pase, escala 28/20/16/15/14/13) y componentes
│  └─ config/              ESLint y TypeScript
├─ tools/deploy/           compose, nginx y scripts (copiados de Yallegó)
└─ docs/
```

- **Dazz:** API, base de datos, contratos, despliegue y la integración del tiempo real en la web.
- **Grimm y My:** `apps/web/src/features/*` y `packages/ui`, una carpeta por pantalla para no pisarse (RNF-30). Mientras la API no esté, trabajan contra datos de ejemplo que cumplen los mismos contratos de `packages/contracts`.
- Los componentes de `packages/ui` se sacan del lienzo; el mapa de pantallas trae la escala tipográfica, los botones y los estados.

## 12. Plan de construcción al 31/10

| Día | Dazz (API e infraestructura) | Grimm y My (web) | Listo cuando |
| --- | --- | --- | --- |
| **Lun 26/10** | Monorepo desde la plantilla de Yallegó, esquema, migraciones, semilla, sesión y primer ingreso. *Staging* en línea | `packages/ui` con tokens y componentes base; barra, pie y acceso | Se entra a *staging* con una cuenta de prueba y se cambia la clave |
| **Mar 27/10** | Catálogo, búsqueda con corrección, ficha por audiencia, prueba de contrato público. Panel del equipo: crear cuentas | Portada, resultados y ficha contra la API | Un visitante busca «rtx 3370» y ve la 3070 sin precio ni tienda |
| **Mié 28/10** | Publicar (sugerencias, uno igual, producto nuevo), fotos, Mis publicaciones | Publicar y Mis publicaciones | Un vendedor publica en menos de 2 minutos (RNF-03) |
| **Jue 29/10** | Mensajes en tiempo real, campanita, bloqueo, «Vendido». **Punto de control del plan B** | Mensajes (página C) y campanita | Dos tiendas conversan en *staging*. Si no está estable: se sale sin chat (documento 04) |
| **Vie 30/10** | Configuración, límites, respaldos y restauración probada. Fabrizio y el equipo cargan el piloto | Configuración y repaso en celular | El piloto tiene sus productos cargados y todo pasa en celular |
| **Sáb 31/10** | Despliegue a producción, prueba de humo y monitoreo | Ajustes finales | PaseLibre en línea |

Si un día se atrasa, se recorta en el orden del documento 04 y no se mueve la fecha.

**Avance al 27/10 (noche):**
- **Día 1 (listo):** monorepo, esquema, semilla, sesión, primer ingreso y la pantalla de acceso de la web.
- **Día 2 (listo):**
  - En la API: portada, categorías, galerías, búsqueda con corrección y facetas, ficha por audiencia y la prueba de contrato público.
  - El panel del equipo (`/equipo/cuentas`) en la API y en la web: crear cuentas, reenviar acceso o dar una contraseña temporal nueva, y suspender o reactivar. Traspasar llegó el 27/10, después del día 5.
- **Día 3 (listo):**
  - En la API: sugerencias «Ya está en PaseLibre», publicar uno igual, producto nuevo en el mismo paso, fotos (`POST /archivos`), Mis publicaciones con pestañas y buscador, editar, pausar, reactivar, eliminar y «Siguen igual».
  - En la web: `/publicar` (también `?igual=` y `?editar=`) y `/mis-publicaciones`, como F_Publicar y F_MisPublicaciones del lienzo, revisadas en computadora y celular.
  - «Ver publicación» y «Ver en la ficha» llevan a `/p/:producto`, que llega con la ficha de la web.
- **Día 4 (listo):**
  - En la API: tiempo real con socket.io, contactar por chat o WhatsApp, conversaciones con filtros y buscador, historial por páginas, texto y fotos, leer y «Visto», silenciar, archivar, no leída, bloquear, denunciar, campanita con «No molestar», contadores y «Vendido» con bloqueo de fila.
  - En la web: `/mensajes` y `/mensajes/:conversacion` como C_Mensajes y F_MovilChat, la ventana de «Vendido», la campanita y el contador de Mensajes en la barra. Revisado en computadora y celular con dos tiendas conversando.
- **Día 5 (listo, la parte de código):**
  - Configuración (`/cuenta/configuracion`) en la API y la web: datos de la persona y de la tienda con logo, contraseña y sesiones abiertas, avisos con «No molestar», «Visto», bloqueados, valores por defecto al publicar y respuestas rápidas. Queda para la fase 2 lo que el lienzo C también trae: perfil privado, «Quién puede escribirte», respuesta automática, idioma y aviso por correo.
  - Límites por IP y por persona (§9).
  - Respaldos: scripts para respaldar, restaurar y ensayar, probados en local (§10).
  - Traspasar (A-11, RF-71) en el panel del equipo: «Traspasar» aparece en las cuentas que tienen algo a su nombre y comparten tienda con otra.
  - Falta, porque depende de personas o del servidor: que Fabrizio y el equipo carguen el piloto, la copia a B2, el cron y el ensayo en *staging*.
- **Parte pública de la web (27/10 noche, adelantada):**
  - Portada (`/`), resultados (`/buscar`) y ficha (`/p/:producto`) como F_Portada, F_Resultados y F_Ficha del lienzo, para quien mira sin sesión y para quien tiene cuenta. Los filtros, el orden y la página viven en la dirección, así que una búsqueda se comparte y funciona sin JavaScript.
  - La barra suma el buscador (también en el celular, en su propia fila). La búsqueda con corrección avisa «Mostramos resultados para …».
  - En la ficha, «Enviar mensaje» abre el chat con la tienda y «WhatsApp» abre el enlace con el mensaje ya escrito (RF-21, RF-23). Un producto unido a otro (RF-54) redirige con 301 a su dirección nueva.
  - La API manda ahora la categoría en cada tarjeta de «Recién publicado», para dibujar su ícono cuando el producto no tiene fotos.
- *Staging* espera a que se decida el servidor: el punto de control del plan B se cumple en local, falta repetirlo en *staging*.

## 13. Pruebas (RNF-32)

- **Unitarias:** normalización y corrección de la búsqueda (con casos reales del chat: «3370», «rtx3070», «ventsu»), reglas de stock y reglas de visibilidad.
- **De contrato:** el JSON de visitante no trae `precio`, `tienda`, `stand` ni `whatsapp`; los contratos Zod coinciden con lo que responde la API.
- **De extremo a extremo** (en *staging*):
  - Ingresar y cambiar la clave.
  - Publicar uno igual.
  - Contactar por mensaje y por WhatsApp.
  - Marcar «Vendido».
  - Que un bloqueado no pueda escribir.
- **Humo después de cada despliegue:** `/v1/salud`, la portada, una búsqueda y el ingreso con una cuenta de prueba.

## 14. Decisiones pendientes

| # | Decisión | Recomendación |
| --- | --- | --- |
| 1 | **Dónde corre:** un VPS nuevo o el mismo de Yallegó. Dazz lo decide al final | Un VPS nuevo y chico: Yallegó maneja pagos y conviene no compartir máquina con un sitio público nuevo. Si se usa el mismo, va con su propio `compose`, su propia base y su propio usuario de sistema |
| 2 | **Dominio** | Comprarlo esta semana; *staging* puede vivir en un subdominio provisional |
| 3 | **Maquetación de Grimm:** si es código (React, HTML) o solo una imagen o un diseño | Preguntárselo a Grimm. Si es código React, sus piezas se reutilizan; si es HTML o un diseño, sirve de referencia y se construye con la línea del lienzo |

## 15. Riesgos técnicos

| ID | Riesgo | Mitigación |
| --- | --- | --- |
| RT-01 | Una caché sirve a un visitante una página con precio | Las páginas con sesión responden `no-store`, nginx no cachea con cookie y hay una prueba de contrato público (sección 5) |
| RT-02 | El WebSocket no pasa por nginx o se corta en redes móviles | Configuración de `upgrade` probada en *staging* el 29/10; al reconectar se recupera lo pendiente (sección 6.3) |
| RT-03 | Con pocos productos, la corrección sugiere palabras equivocadas | `termino` se arma solo con el catálogo real y el tope de distancia es 1; las búsquedas sin resultados se revisan cada semana |
| RT-04 | Los duplicados crecen más rápido de lo que el equipo une | La sugerencia al publicar usa la misma búsqueda tolerante, y el panel lista los posibles duplicados por similitud |
| RT-05 | Un solo VPS es un punto único de falla | Respaldos diarios con restauración probada y un monitor externo. Con el piloto, la meta es el 99 % (RNF-12) |
| RT-06 | El plazo: seis días para cuatro personas | Plan día por día, recortes del documento 04 y plan B el 29/10 |
