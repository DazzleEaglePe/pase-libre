# 07 · Contrato de la API

**Versión:** 0.2 · **Fecha:** 29/10/2026 · **Responsable:** Dazz

Qué rutas tiene la API, qué recibe cada una y qué responde. Sale de las secciones 6.2 y 6.3 del [documento 05](05-arquitectura.md#6-rutas-de-la-web-y-de-la-api), revisadas contra los controladores. Las rutas de la web están en el [documento 09](09-ux-y-flujos.md).

**La fuente de verdad son los contratos:** los esquemas Zod y los tipos de [`packages/contracts`](../packages/contracts/src), que comparten la API, la web y la futura app (RNF-47). La API valida cada cuerpo y cada consulta con ellos, y la web los usa para tipar las respuestas. No hay Swagger ni OpenAPI.

| Carpeta de `packages/contracts/src` | Qué tiene |
| --- | --- |
| `sesion/` | Ingreso, cambio de clave y `GET /yo` |
| `catalogo/` | Portada, búsqueda, ficha y la normalización de texto que comparten la búsqueda y las etiquetas |
| `ofertas/` | Publicar, editar, Mis publicaciones y sugerencias |
| `mensajes/` | Conversaciones, mensajes, avisos, contadores y los eventos del tiempo real |
| `cuenta/` | Configuración |
| `equipo/` | El panel del equipo |
| `comun/` | Errores, dinero y salud |

---

## 1. Reglas generales

- **Base:** todo cuelga de `/v1`. En producción la web y la API comparten dominio: nginx manda `/v1` y `/tiempo-real` a la API ([DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md)).
- **JSON en `snake_case` y en español:** `precio_centimos`, `debe_cambiar_clave`, `ultimo_mensaje_en`.
- **Sesión:** cookie `pl_sesion` (`HttpOnly`, `SameSite=Lax` y `Secure` en producción). La futura app usará el mismo token como `Bearer` (A-05). Cómo se abre y se cierra, en el [documento 08](08-seguridad-y-autenticacion.md).
- **Cabecera obligatoria:** toda petición `POST`, `PUT`, `PATCH` o `DELETE` lleva la cabecera `X-PaseLibre` con cualquier valor (la web manda `1`). Sin ella, la API responde 403 `FALTA_CABECERA_PASELIBRE`. Es la defensa contra CSRF.
- **Respuesta por audiencia (A-06):** una misma ruta responde distinto al visitante, al vendedor con sesión y al dueño de la oferta. El visitante **nunca** recibe `precio`, `tienda`, `stand` ni `whatsapp`; lo comprueba la prueba [`contrato-publico.e2e-spec.ts`](../apps/api/test/contrato-publico.e2e-spec.ts). Quién ve qué, en el [documento 08 §2](08-seguridad-y-autenticacion.md#2-quién-ve-qué).
- **Caché:** sin sesión, `public, max-age=60, stale-while-revalidate=60`; con sesión, `private, no-store`. Siempre con `Vary: Cookie`.
- **Dinero:** `precio_centimos` entero (US$ 250 → `25000`) y `moneda` (`USD` o `PEN`).
- **Fechas:** ISO 8601 en UTC. La web las muestra en hora de Lima («Hoy», «Ayer», «Hace 9 días»).

### Errores

Todos con la misma forma, y el mensaje ya en español para mostrarlo tal cual:

```json
{
  "error": {
    "codigo": "CREDENCIALES_INVALIDAS",
    "mensaje": "El usuario o la contraseña no coinciden.",
    "detalles": {},
    "id_solicitud": "…"
  }
}
```

| Código | Estado HTTP habitual | Cuándo |
| --- | --- | --- |
| `DATOS_INVALIDOS` | 400 | El cuerpo o la consulta no cumple su esquema. `detalles` dice qué campo |
| `SIN_SESION` | 401 | La ruta pide sesión |
| `PROHIBIDO` | 403 | La sesión no puede tocar ese recurso (otra tienda, o no es del equipo) |
| `FALTA_CABECERA_PASELIBRE` | 403 | Falta `X-PaseLibre` en una petición que cambia datos |
| `DEBE_CAMBIAR_CLAVE` | 403 | Entró con la clave temporal y todavía no creó la suya |
| `NO_ENCONTRADO` | 404 | No existe, o no es visible para quien pregunta |
| `CONFLICTO` | 409 | Ya existe (por ejemplo, otra oferta vigente igual) o el estado no lo permite |
| `CREDENCIALES_INVALIDAS` | 401 | Usuario o contraseña incorrectos |
| `CUENTA_SUSPENDIDA` | 403 | El equipo suspendió la cuenta |
| `CUENTA_BLOQUEADA_TEMPORALMENTE` | 429 | Demasiados intentos fallidos con esa cuenta |
| `CLAVE_ACTUAL_INCORRECTA` | 400 | Al cambiar la contraseña desde Configuración |
| `BLOQUEADO` | 403 | La otra persona bloqueó a tu tienda |
| `DEMASIADAS_SOLICITUDES` | 429 | Se pasó un límite ([documento 08 §4](08-seguridad-y-autenticacion.md#4-límites)) |
| `SERVICIO_NO_DISPONIBLE` | 503 | La base no responde |
| `ERROR_INTERNO` | 500 | Cualquier otra falla; `id_solicitud` sirve para buscarla en los registros |

El estado HTTP de cada código es el habitual; para decidir qué mostrar, la web mira el `codigo`, no el estado.

## 2. Rutas

**Quién** dice qué hace falta: *Todos* (también sin sesión), *Vendedor* (sesión con contraseña propia y una tienda) o *Equipo* (`rol = EQUIPO`).

### 2.1 Catálogo público

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `GET /portada?galeria=` | Todos | «Recién publicado» (con la categoría de cada tarjeta) y los conteos por categoría | 44 |
| `GET /categorias` | Todos | Las categorías, para el menú y los filtros | 11 |
| `GET /galerias` | Todos | Las galerías activas | 17 |
| `GET /mapa-del-sitio` | Todos | Cada producto con una oferta vigente y la fecha de la más reciente, para el `sitemap.xml` de la web | RNF-42 |
| `GET /buscar` | Todos | Productos con el resumen de sus ofertas, las facetas y la corrección | 12–18 |
| `GET /buscar/sugerencias?q=&categoria=` | Todos | El desplegable del buscador: hasta 5 productos y la corrección, **sin registrar la búsqueda** y sin precios ni tiendas aunque haya sesión. 120 por minuto | 13, 14 |
| `GET /buscar/populares` | Todos | «Lo más buscado»: hasta 4 búsquedas de los últimos 30 días que encontraron algo y se repitieron, como más se escribieron | 32 |
| `GET /productos/:slug` | Todos | El producto y sus ofertas, según la audiencia. Si el producto se unió a otro, responde `{ "redirigir_a": "<slug>" }` y la web redirige con 301 | 19, 52 |

**`GET /buscar` recibe:**

| Parámetro | Valores | Nota |
| --- | --- | --- |
| `q` | Texto, hasta 100 caracteres | Se normaliza y se corrige: «rtx 3370» → «rtx 3070» |
| `categoria` | Un *slug* | |
| `galeria`, `marca` | Uno o más *slugs* | |
| `condicion` | `nuevo`, `usado` (uno o los dos) | |
| `stock` | `true` | Solo con stock |
| `precio_min`, `precio_max`, `moneda` | Números y `USD` o `PEN` | **Solo con sesión.** Al visitante se le ignoran, para que no adivine precios probando rangos |
| `orden` | `recientes`, `precio_asc`, `precio_desc` | El orden por precio solo con sesión |
| `pagina` | 1 a 500 | |

Cuando corrige, la respuesta trae `{ "correccion": { "buscaste": "rtx 3370", "mostramos": "rtx 3070" } }`. Cómo busca, en el [documento 05 §7](05-arquitectura.md#7-búsqueda-tolerante-a-errores).

### 2.2 Sesión

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `POST /sesion` | Todos | Ingresar con usuario o correo y contraseña, con «Mantener la sesión» o sin él. Deja la cookie | 02 |
| `DELETE /sesion` | Con sesión | Salir: revoca la sesión y corta sus sockets | |
| `POST /sesion/clave` | Con sesión | Crear la contraseña propia en el primer ingreso, o cambiarla | 50, 60 |
| `GET /yo` | Con sesión | El usuario y su tienda, con los valores por defecto al publicar | |

### 2.3 Publicar y Mis publicaciones

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `GET /catalogo/sugerencias?q=` | Vendedor | «Ya está en PaseLibre»: productos parecidos, con la misma búsqueda tolerante | 53 |
| `GET /catalogo/sugerencias?producto=` | Vendedor | Un producto, para «Publicar uno igual» desde la ficha | 53 |
| `POST /archivos` | Vendedor | Subir una foto (multipart, campo `foto`). Devuelve la ruta para usarla en una oferta, un producto o el chat | 05, 39 |
| `POST /ofertas` | Vendedor | Publicar: «uno igual» con `producto_id`, o con `producto_nuevo`. Producto y oferta se crean en una sola transacción | 05, 06, 38 |
| `GET /mis-ofertas?estado=&q=` | Vendedor | Las de su tienda: activas, sin stock o pausadas, con buscador | 08 |
| `GET /ofertas/:id` | Vendedor | Una oferta propia, para editarla | 08 |
| `PATCH /ofertas/:id` | Vendedor | Condición, stock, precio, moneda, visibilidad, descripción y fotos; pausar o reactivar | 06, 08, 09 |
| `DELETE /ofertas/:id` | Vendedor | Eliminar (queda `ELIMINADA`) | 08 |
| `POST /ofertas/confirmar` | Vendedor | «Siguen igual» para las de más de 7 días | 10 |

### 2.4 Contactar, mensajes y «Vendido»

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `POST /ofertas/:id/contacto` | Vendedor | Abre el hilo o devuelve el enlace de WhatsApp con el mensaje armado, y registra el clic. No se contacta a la propia tienda ni a quien te bloqueó | 21, 23 |
| `GET /conversaciones?filtro=&q=` | Vendedor | Su bandeja: todas, no leídas o archivadas, con buscador por tienda o producto | 55 |
| `GET /conversaciones/:id` | Vendedor | El hilo con el producto arriba, si el otro está activo y si se puede marcar «Vendido» | 55, 47 |
| `GET /conversaciones/:id/mensajes?antes=` | Vendedor | El historial por páginas, hacia atrás | 39 |
| `POST /conversaciones/:id/mensajes` | Vendedor | Enviar texto o una foto | 39 |
| `PATCH /conversaciones/:id` | Vendedor | Leer, marcar como no leída, silenciar, archivar | 57 |
| `POST /conversaciones/:id/bloqueo` | Vendedor | Bloquear a la tienda del otro | 57 |
| `DELETE /conversaciones/:id/bloqueo` | Vendedor | Desbloquear | 57 |
| `POST /denuncias` | Vendedor | Denunciar una oferta, una conversación o una tienda | 57 |
| `GET /ofertas/:id/interesados` | Vendedor | Quiénes escribieron por esa oferta a quien vende, para elegir a quién se vendió | 47 |
| `POST /ofertas/:id/vendido` | Vendedor | Resta 1 al stock y deja el aviso en el chat | 47 |
| `GET /avisos` | Vendedor | La campanita | 40 |
| `POST /avisos/leidos` | Vendedor | Marcar avisos como leídos | 40 |
| `GET /contadores` | Vendedor | Las insignias de Mensajes y de la campanita | 40, 55 |

### 2.5 Configuración

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `GET /cuenta`, `PATCH /cuenta` | Vendedor | Datos de la persona y de la tienda, logo, «Visto» y valores por defecto al publicar. Usuario, galería y stand solo los cambia el equipo | 48, 57, 58 |
| `GET /cuenta/avisos`, `PUT /cuenta/avisos` | Vendedor | Campanita por tipo de aviso y «No molestar» (hora de Lima) | 59 |
| `GET /cuenta/respuestas-rapidas`, `PUT /cuenta/respuestas-rapidas` | Vendedor | Hasta 8, en orden y sin repetir | 56 |
| `GET /cuenta/sesiones` | Vendedor | Sesiones abiertas, por navegador | 60 |
| `DELETE /cuenta/sesiones/:id` | Vendedor | Cerrar una | 60 |
| `POST /cuenta/sesiones/cerrar-otras` | Vendedor | Cerrar todas menos la actual | 60 |
| `GET /cuenta/bloqueados` | Vendedor | Tiendas bloqueadas | 57 |
| `DELETE /cuenta/bloqueados/:tienda` | Vendedor | Desbloquear una | 57 |

### 2.6 Panel del equipo

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `GET /equipo/cuentas` (también `?tienda=`) | Equipo | Las cuentas, con su estado y lo que cada una tiene a su nombre | 35, 49 |
| `POST /equipo/cuentas` | Equipo | Crear una cuenta (y su tienda, si es nueva) con clave temporal | 35 |
| `POST /equipo/cuentas/:id/clave-temporal` | Equipo | Una clave temporal nueva; obliga a cambiarla al entrar | 50 |
| `PATCH /equipo/cuentas/:id` | Equipo | Suspender o reactivar | 28 |
| `POST /equipo/cuentas/:id/traspasar` | Equipo | Pasar publicaciones e hilos a otra cuenta activa de la misma tienda | 71 |
| `GET /equipo/tiendas` | Equipo | Tiendas activas, para elegir la de un asesor | 35 |

**Prometidas en el documento 05 y todavía no construidas:**

| Método y ruta | Qué haría | RF | Estado |
| --- | --- | --- | --- |
| `POST /equipo/cargas`, `POST /equipo/cargas/:id/confirmar` | Carga por planilla con vista previa | 34 | Fase 2 (la tabla `carga_planilla` ya existe) |
| `GET /equipo/duplicados`, `POST /equipo/productos/:id/unir` | Ver y unir productos duplicados | 54 | Pendiente ([checklist](CHECKLIST.md)) |
| Ver denuncias | La cola de denuncias abiertas | 28 | Pendiente ([checklist](CHECKLIST.md)) |

### 2.7 Operación

| Método y ruta | Quién | Qué hace |
| --- | --- | --- |
| `GET /salud` | Todos | El proceso responde. No toca la base, para que una caída de Postgres no reinicie la API en cadena |
| `GET /salud/lista` | Todos | La base responde: `{ "estado": "ok", "base_de_datos": "ok" }`, o 503 si no. Es la que mira el monitor externo (RNF-39) |

Las fotos se sirven en `/media/…`, fuera de `/v1`: en producción las entrega nginx desde la carpeta del servidor, con caché de un año (cada foto tiene un nombre que no se reutiliza).

### 2.8 En vivo (D-53)

Construidas el 29/10. **Con `EN_VIVO` apagado responden 404**, como si no existieran ([documento 11 §7](11-plan-de-desarrollo.md#7-en-vivo)). Siguen las reglas de arriba: el visitante recibe el producto, la categoría, la galería y `vence_en`, nunca `precio_centimos`, la tienda ni el presupuesto.

| Método y ruta | Quién | Qué hace | RF |
| --- | --- | --- | --- |
| `GET /en-vivo?tipo=&categoria=&galeria=` | Todos | Lo que está en vivo, lo que vence primero arriba, y los cerrados de hoy. Responde por audiencia, con la caché de 60 s sin sesión | 25, 75, 77 |
| `GET /en-vivo/mios` | Vendedor | «Lo tuyo en vivo»: los suyos, con cuántas respuestas tiene cada uno | 75 |
| `GET /en-vivo/alcance?producto=` (o `?q=`) | Vendedor | A cuántas tiendas les llegará el aviso, para la vista previa de Publicar | 76 |
| `POST /en-vivo` | Vendedor | Publicar un busco o una oferta flash. 409 `LIMITE_EN_VIVO` si ya tiene 3. 10 por hora por persona | 24, 72, 73 |
| `PATCH /en-vivo/:id` | Quien lo publicó | Sumar una hora o cerrar («Ya lo conseguí», «Cerrar oferta») | 27 |
| `GET /en-vivo/:id/opciones` | Vendedor de otra tienda | Sus publicaciones activas y con stock que coinciden con el busco (las que atiende), para «¿Cuál tienes?» | 26 |
| `POST /en-vivo/:id/respuestas` | Vendedor de otra tienda | «¡Lo tengo!» (con la publicación que ofrece) o «¡Lo quiero!». Abre o reutiliza el hilo, deja la tarjeta arriba y avisa. 409 `YA_RESPONDISTE` | 26, 76 |

«Vendido» sigue siendo `POST /ofertas/:id/vendido`: si el hilo viene de una oferta flash, además resta una unidad de la oferta y la cierra al llegar a 0. `GET /conversaciones/:id` trae `en_vivo` con la tarjeta del hilo, y `GET /cuenta/avisos` suma `campanita.EN_VIVO` solo con el interruptor encendido.

## 3. Tiempo real

El navegador abre un socket de socket.io en `/tiempo-real` (fuera de `/v1`) con su cookie. Solo entra una sesión vigente con contraseña propia, y el *handshake* revisa el origen: CORS no protege a un WebSocket.

La API une cada socket a la sala de su usuario (`usuario:<id>`), a la de su tienda (`tienda:<id>`) y a la de su sesión (`sesion:<id>`).

| Evento | Va a | Para qué |
| --- | --- | --- |
| `tiempo-real:listo` | El socket que entra | Ya está en sus salas: desde aquí no se pierde nada |
| `mensaje:nuevo` | Las dos personas del hilo | Pintar el mensaje y subir el contador |
| `mensaje:visto` | Quien escribió | «Visto», si el otro no lo desactivó |
| `aviso:nuevo` | El usuario | La campanita |
| `oferta:stock` | La tienda dueña | Refrescar Mis publicaciones después de un «Vendido» |
| `contadores:cambio` | El usuario | Se leyó algo en otra pestaña: volver a pedir las insignias |
| `en-vivo:cambio` | Todos los sockets | *(D-53)* Hay uno nuevo, cambió o se cerró: volver a pedir `GET /en-vivo`. Sin sesión no hay socket, así que la web la vuelve a pedir cada 60 s mientras se ve |

- El socket solo **avisa**; todo se lee y se escribe por las rutas REST. Al reconectar, la web vuelve a pedir la bandeja, la conversación abierta y los contadores, así que no se pierde nada si el socket se cae.
- Salir corta los sockets de esa sesión; suspender una cuenta o darle una clave nueva corta todos los suyos.
- **En local** la web se conecta directo a la API (`localhost:3001`), porque el *rewrite* de Next no pasa WebSockets. En producción va por el mismo dominio y nginx hace el `upgrade`.

## 4. Cómo se cambia el contrato

1. Se cambia el esquema o el tipo en `packages/contracts` y se reconstruye el paquete (`pnpm --filter @paselibre/contracts build`, o `pnpm typecheck`, que lo hace por turbo).
2. TypeScript marca en la API y en la web todo lo que hay que ajustar.
3. **Solo se agrega:** un campo nuevo es opcional o tiene valor por defecto, y un campo no se quita ni cambia de tipo mientras la versión anterior de la web pueda estar abierta. Cuando llegue la app del celular, un cambio que rompa irá en `/v2`.
4. Si el cambio toca lo que ve el visitante, la prueba de contrato público tiene que seguir pasando.
