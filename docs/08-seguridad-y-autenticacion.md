# 08 · Seguridad y autenticación

**Versión:** 0.1 · **Fecha:** 28/10/2026 · **Responsable:** Dazz

Cómo se entra, qué ve cada quien, qué límites hay y qué protege cada pieza. Sale de las secciones 5 y 9 del [documento 05](05-arquitectura.md#9-cuentas-sesiones-y-seguridad) y de las notas de seguridad de [DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md#notas-de-seguridad), revisadas contra el código. Cumple RNF-15 a RNF-24, RNF-44, RNF-50 y RNF-53 del [documento 03](03-requerimientos-no-funcionales.md).

Al final, en la sección 9, está lo que el documento 05 promete y el código todavía no tiene.

---

## 1. Roles

| Rol | Puede |
| --- | --- |
| Visitante (sin sesión) | Ver y buscar el catálogo público, sin precio ni datos de la tienda |
| Dueño, asesor e independiente | Lo anterior, más ver precios y tiendas, contactar, publicar, gestionar las ofertas de **su** tienda, **sus** mensajes y su configuración |
| Equipo | El panel del equipo: crear cuentas, claves temporales, suspender y traspasar. **No ve mensajes** (RNF-44) |

En la primera salida el dueño y el asesor pueden lo mismo dentro de su tienda. La diferencia (el dueño crea asesores, con límite por plan) llega con RF-36. Las cuentas del equipo no tienen tienda: la base lo exige (`rol = EQUIPO` si y solo si `tienda_id` es nulo).

## 2. Quién ve qué

| Dato | Visitante | Vendedor con sesión | Dueño de la oferta | Equipo |
| --- | --- | --- | --- | --- |
| Producto, fotos, etiquetas, características | Sí | Sí | Sí | Sí |
| Condición, stock, galería, fecha de actualización | Sí | Sí | Sí | Sí |
| Nombre de la tienda y stand | **No** («Tienda de Maxiplaza») | Sí | Sí | Sí |
| Precio visible | **No** («Precio con sesión») | Sí | Sí | Sí |
| Precio oculto | **No** | **No** («Al interno · consultar») | Sí | Sí |
| WhatsApp | **No** | Solo al pulsar el botón (A-07) | Sí | Sí |
| Mensajes | **No** | Solo los suyos | Solo los suyos (es el responsable) | **No** |

**Cómo se garantiza (A-06):**

- **El servidor no lo manda.** Cada audiencia tiene su propio `select` de Prisma y su propio contrato. Las consultas de visitante no leen las columnas de precio ni de tienda: esconderlo en la interfaz no basta.
- **Una prueba lo vigila.** [`contrato-publico.e2e-spec.ts`](../apps/api/test/contrato-publico.e2e-spec.ts) pide como visitante la portada, la búsqueda y la ficha, y falla si el JSON trae `precio`, `tienda`, `stand` o `whatsapp`. La prueba de humo de cada despliegue lo repite contra el servidor.
- **No se deja deducir el precio.** Al visitante, las ofertas de la ficha le llegan por fecha, no por precio, y se le ignoran el filtro y el orden por precio: si no, podría adivinarlo probando rangos.
- **WhatsApp a pedido (A-07).** El número no viaja en la página: el botón llama a `POST /v1/ofertas/:id/contacto` y la API devuelve el enlace `wa.me`. Protege los números del *scraping* (RNF-19) y registra el clic.
- **Las cachés no mezclan audiencias.** Sin sesión, la API responde `public, max-age=60`; con sesión, `private, no-store`, siempre con `Vary: Cookie`. nginx no cachea respuestas con cookie.
- **Clave temporal = visitante.** Quien entró con la clave que dio el equipo y todavía no creó la suya ve el catálogo como visitante: nadie ve precios con una clave que conoce otra persona.

## 3. Ingreso y sesión

**Ingreso (RF-02):**

- Con usuario o correo (sin distinguir mayúsculas) y contraseña.
- Las contraseñas se guardan con **argon2id**, con los mismos parámetros que Yallegó.
- **Reglas:** al menos 8 caracteres y un número, y no puede ser una de las más comunes («12345678», «qwerty123»…).
- **Primer ingreso:** la clave temporal que entrega el equipo deja `debe_cambiar_clave` encendido. Hasta crear la suya («Crea tu contraseña»), la persona solo puede cambiarla: el resto de la API responde `DEBE_CAMBIAR_CLAVE`.
- **Contraseña olvidada (RF-50):** se pide al equipo por WhatsApp, que da una clave temporal nueva. No hay recuperación por correo en la primera salida.
- **Intentos fallidos:** después de 5 seguidos con la misma cuenta en 15 minutos, la cuenta se frena un rato (`CUENTA_BLOQUEADA_TEMPORALMENTE`). Los mensajes de error no dicen si el usuario existe.

**Sesión (A-05):**

- Un token opaco al azar va en la cookie `pl_sesion`; la base guarda solo su SHA-256 en la tabla `sesion`. Quien lea la base no puede usar las sesiones.
- La cookie es `HttpOnly`, `SameSite=Lax` y, en producción, `Secure`. **La API se niega a arrancar en producción** si la cookie no es `Secure` o si los registros están en `debug`.
- **Duración:** 12 horas, y la cookie muere al cerrar el navegador. Con «Mantener la sesión», 30 días, que se renuevan con el uso.
- **Cortes inmediatos:** salir revoca la sesión; suspender una cuenta o darle una clave nueva revoca todas las suyas y corta sus sockets. Por eso no se usa JWT: un JWT sigue valiendo hasta que vence.
- **Sesiones abiertas:** en Configuración · Seguridad se ven por navegador y se pueden cerrar una por una o todas las demás.

**CSRF:** toda petición que cambia datos (`POST`, `PUT`, `PATCH`, `DELETE`) lleva la cabecera `X-PaseLibre`. Un formulario o un enlace de otro sitio no puede ponerla, y `SameSite=Lax` cubre el resto. Sin ella, la API responde 403.

**Tiempo real:** el socket de `/tiempo-real` solo acepta una sesión vigente con contraseña propia, y revisa el origen en el *handshake*: CORS no protege a un WebSocket, y sin esa revisión otro sitio podría abrirlo con la cookie del vendedor.

## 4. Límites

En una galería muchas tiendas salen a internet con la misma IP, así que cada petición pasa por dos contadores ([`apps/api/src/shared/limites.ts`](../apps/api/src/shared/limites.ts)):

- **Por IP:** un techo alto, 600 por minuto.
- **Por persona:** 120 por minuto, contado por su sesión, o por IP si no tiene sesión.

Y cada ruta sensible tiene el suyo:

| Ruta | Límite | Se cuenta por |
| --- | --- | --- |
| Ingreso | 5 intentos fallidos cada 15 minutos | Cuenta |
| Ingreso | 60 intentos cada 15 minutos | IP |
| Cambio de contraseña | 10 cada 15 minutos | Persona |
| Búsqueda | 60 por minuto | Persona (sin sesión, IP) |
| Contactar (da el WhatsApp) | 30 por minuto | Persona |
| Mensajes | 30 por minuto | Persona |
| Subir fotos | 30 por hora | Persona |
| Denuncias | 10 por hora | Persona |

**La IP real:** detrás de nginx, la API lee la IP del cliente en `X-Forwarded-For` solo si la petición viene de una red de confianza (`PROXIES_DE_CONFIANZA`, `uniquelocal` en el servidor). nginx **pisa** esa cabecera con la IP que ve, así que un cliente no puede inventar la suya para saltarse los límites. Falta probarlo en *staging* con la IP verdadera.

*Cambio del 27/10:* antes había un único límite de 120 por minuto por IP y el ingreso permitía 20 por IP. El día del piloto, toda una galería con el mismo wifi se hubiera frenado entre sí.

## 5. Entradas y fotos

- **Todo se valida:** cada cuerpo y cada consulta pasa por su esquema Zod antes de llegar a la lógica. Lo que no lo cumple se rechaza con `DATOS_INVALIDOS`.
- **Sin HTML:** el texto del chat y de las descripciones se guarda plano y React lo escapa al pintarlo.
- **Fotos (RNF-20):**
  - Solo JPEG, PNG o WebP, hasta 8 MB, revisando el contenido y no solo la extensión.
  - Cada foto se vuelve a codificar en WebP, enderezada y con el lado mayor en 1600 px como máximo. Así se quitan los metadatos EXIF, que pueden traer la ubicación de la tienda.
  - Se guardan con un nombre al azar (`2026/10/<uuid>.webp`), que no se adivina ni se reutiliza.
  - Una foto subida solo la puede usar alguien de su misma tienda, y una sola vez.

## 6. Permisos

- Cada ruta de vendedor comprueba que la oferta, el hilo o la tienda sean de la tienda de la sesión (RNF-17). Si no, la API la rechaza.
- Las rutas del equipo exigen `rol = EQUIPO`.
- Las acciones del equipo (crear cuenta, nueva clave, suspender, traspasar) quedan en la tabla `auditoria`.
- **Mensajes privados (RNF-44):** el panel del equipo no tiene ninguna ruta para leer conversaciones. Una denuncia guarda el motivo y el identificador del hilo; si el equipo necesita ver mensajes, se los pide a quien denunció.
- **Bloqueo (RF-57):** quien bloquea, bloquea a la tienda entera. Antes de guardar un mensaje o de contactar, la API revisa la tabla `bloqueo`; el bloqueado recibe `BLOQUEADO` y al otro no se le avisa.

## 7. Cabeceras y red

- **API:** `helmet` con sus valores por defecto (CSP, `X-Content-Type-Options`, `X-Frame-Options` y otras). CORS solo para la dirección de la web y con credenciales.
- **Web:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS de un año, `Cross-Origin-Opener-Policy` y `Permissions-Policy` sin cámara, micrófono, ubicación ni pagos ([`next.config.mjs`](../apps/web/next.config.mjs)).
- **Servidor:** cortafuegos con solo 22, 80 y 443. Postgres no se publica; la API y la web escuchan solo en `127.0.0.1`, detrás de nginx con Let's Encrypt.
- **Secretos:** el archivo de entorno de cada servidor vive fuera del repositorio, con permisos 600. El repositorio es público: ninguna clave real va en él. La clave de las cuentas de demostración sale de `CLAVE_DEMO` y `semilla-demo.sh` exige una propia.

## 8. Datos personales

- El WhatsApp de la tienda es un dato personal (RNF-21): solo lo ve quien tiene sesión y pulsa el botón, y cada entrega queda registrada.
- No se guardan pagos ni datos financieros (RNF-37).
- Los respaldos de la base y de las fotos van a B2 ([RESPALDOS.md](../tools/deploy/RESPALDOS.md)).

## 9. Lo que falta

| Qué | Requerimiento | Estado |
| --- | --- | --- |
| **Términos de uso y política de privacidad**, revisados con la Ley 29733 | RNF-22, RNF-23 | Borradores en `/terminos` y `/privacidad` (28/10). Faltan la revisión y los datos del responsable ([checklist](CHECKLIST.md)) |
| **Consentimiento del WhatsApp** al crear la cuenta | RNF-21 | El documento 05 lo promete; el formulario del equipo no lo pide todavía. Va con los términos |
| **Borrar una cuenta a pedido:** anonimizar al usuario, eliminar sus ofertas y conservar las ventas sin datos personales | RNF-24 | El documento 05 lo promete; no hay script ni ruta. Mientras tanto, el equipo suspende la cuenta |
| **CSP en la web** | RNF-19 | La API la tiene (por `helmet`); la web no. Hay que definirla sin romper el socket ni las fotos |
| **Revisar las denuncias** | RNF-53, RF-28 | Se guardan, pero el equipo no tiene dónde verlas |
| **IP real y TLS** probados en el servidor | RNF-19 | Probado solo en local; se repite en *staging* |
