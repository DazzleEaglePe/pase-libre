# 16 · Seguridad frente a ataques y capacidad de carga

> **Fecha:** 11/11/2026 · **Estado:** la **fase 0 (nginx) está aplicada en producción** desde el 11/11/2026 a las 23:38 (hora de Lima); ver §4.2. Lo demás es propuesta: se midió en una copia local.
> No reemplaza a [docs/08](08-seguridad-y-autenticacion.md) (seguridad de la aplicación) ni a [docs/15](15-calidad.md) (la primera prueba de carga, del 09/11): los complementa.

## 1. Resumen

1. **Hoy no hay nada delante del servidor.** El DNS está en Spaceship y apunta directo a la IP del VPS (`167.148.33.199`, ReliableSite, Miami). Lo que llega a internet es nginx sin límites de peticiones, sin `fail2ban` y sin actualizaciones automáticas. Lo bueno: firewall `ufw` cerrado salvo 22/80/443, SSH solo con llave y sin root, y los servicios de la aplicación solo escuchan en `127.0.0.1`.
2. **Cloudflare resuelve la mitad del problema y es gratis**: DDoS de red y de HTTP sin medidor, caché, 5 reglas de WAF, 1 regla de límite de tasa, Turnstile (CAPTCHA sin molestar). Pero **no resuelve lo que más duele**: el costo de las consultas de la propia aplicación (§3).
3. **Inyección SQL: el riesgo es bajo por diseño.** Todo el SQL a mano usa parámetros (`Prisma.sql`), no existe `queryRawUnsafe` ni `Prisma.raw`, y la web no usa `dangerouslySetInnerHTML`. El WAF sería una segunda barrera, no la primera.
4. **El cuello de botella real es Postgres, no Node.** Con un catálogo de 60 mil productos y 180 mil ofertas, 50 visitantes a la vez bajan la API de **2 071 a 53 pedidos por segundo**; Postgres usa los 10 núcleos de la prueba y la API menos de un cuarto de uno.
5. **Migrar a Go o Rust no ahora.** Reescribir la API aceleraría la parte que hoy consume menos del 3 % de la CPU. El orden correcto está en §6: Cloudflare y nginx → arreglar la búsqueda → medir de nuevo → recién entonces decidir.
6. **Hallazgo funcional aparte (ya corregido):** nginx cortaba cualquier subida de más de 9 MB y «Importar catálogo» del panel del equipo acepta hasta 40 MB: un `.zip` de 12 MB daba 413 en producción (§2, H4). Se arregló en la fase 0.

## 2. Dónde estamos (verificado el 11/11/2026)

| # | Hallazgo | Cómo se verificó | Riesgo |
|---|---|---|---|
| H1 | **Sin CDN/WAF; el origen está expuesto.** NS en `launch1/2.spaceship.net`, registro A directo al VPS | `dig` | Alto: cualquier inundación llega al VPS |
| H2 | **nginx sin `limit_req`/`limit_conn`**, `worker_connections 768`, sin tiempos de espera propios (nginx 1.22.1) | Lectura de `/etc/nginx` | **Resuelto en la fase 0** (§4.2) |
| H3 | **Sin `fail2ban`/CrowdSec; `unattended-upgrades` inactivo**; Debian 12 pasa a soporte extendido (LTS) según el calendario de Debian | `systemctl`, `apt` | Medio |
| H4 | **`client_max_body_size 9m` en nginx** frente a 40 MB de «Importar catálogo» del equipo | Probado en producción sin sesión: 12 MB daba 413 (nginx) | **Resuelto en la fase 0**: 12 MB ya llega a la API (401 sin sesión) |
| H5 | **La búsqueda cuesta tanto como el catálogo.** Cada pedido arma y agrupa todas las ofertas que coinciden, y lo hace dos veces (lista y totales). Sin texto, con 60 mil productos: **1,2 s** | k6 y `tools/carga` en copia local (§3) | Alto cuando el catálogo crezca |
| H6 | **El ingreso es caro a propósito** (argon2id, 64 MB por intento). 4 intentos a la vez suman ~190 MB; el contenedor de la API tiene tope de **448 MB** y ya usa ~160 | `tools/carga/ips.js`, README de `tools/carga` | Medio: un ataque repartido entre muchas IPs puede tumbar la API |
| H7 | **Los contadores del limitador viven en la memoria del proceso.** 120 mil pedidos desde 120 mil IPs distintas dejaron la API en ~1 GB (con 40 IPs: ~0,5 GB); a los 40 s volvió a ~0,5 GB. Se pierden al reiniciar y no se comparten entre réplicas | `tools/carga/ips.js` (con `tsx`, no con el build) | Medio |
| H8 | **Detrás de Cloudflare, sin configurar `real_ip`, todas las personas parecerían venir de unas pocas IPs de Cloudflare** y compartirían los límites (3 000 por minuto; 60 ingresos cada 15 min) | Lectura de `limites.ts` y de nginx | Crítico para la migración (§4.1) |
| H9 | **Sin CSP en la web** (la API sí la tiene por `helmet`) | `curl -I`, docs/08 §145 | Medio |
| H10 | **Servidor compartido y justo de memoria**: 3,9 GB de RAM para PaseLibre + Yallegó (prod y staging) + ecabot + linerook; quedan ~1 GB disponibles y 600 MB de swap en uso. Contenedores de PaseLibre: web 320 MB, API 448 MB, Postgres 256 MB | `free`, `docker stats` | Medio: un ataque a uno afecta a los otros |
| H11 | **Copias de seguridad solo en el mismo servidor** (sin `RCLONE_DESTINO`) | docs/RESPALDOS | Alto si se pierde el VPS |

Lo que **ya está bien**: `helmet`, validación con Zod, SQL parametrizado, argon2id, sesión por cookie con cabecera anti-CSRF `X-PaseLibre`, origen verificado en el WebSocket, límites de tamaño en las subidas, límite de peticiones en dos capas (por IP y por persona, más topes por ruta), respuestas públicas ya marcadas `Cache-Control: public, max-age=60` con `Vary: Cookie` (listas para una caché), SSH con llave, firewall cerrado, puertos internos en `127.0.0.1`, respaldos diarios con ensayo de restauración.

## 3. Lo que medí (copia local, no producción)

**Método.** Mac M5 de 10 núcleos (más rápida que el VPS de 2 núcleos compartidos: los números absolutos del VPS serán menores, las proporciones no). API compilada en modo producción, pool de 15 conexiones como en producción, Postgres 16 en Docker en la misma máquina. Herramienta: `tools/carga/carga.mjs` (la del 09/11) y k6. Base con **60 117 productos y 179 663 ofertas** sintéticos (`tools/carga/catalogo-grande.sql`), 50 visitantes a la vez, una IP distinta por pedido. Los números de «antes» son los del README de `tools/carga`.

| | 09/11 (116 productos, 2 450 ofertas) | Hoy (60 117 productos, 179 663 ofertas) |
|---|---|---|
| Pedidos por segundo | **2 071** | **53** (÷ 39) |
| p95 búsqueda con texto | 56 ms | 2 177 ms |
| p95 búsqueda por categoría | — | 2 743 ms |
| p95 ficha de producto | 35 ms | 955 ms |
| p95 portada | 23 ms | 617 ms |
| CPU de la API | — | **8–26 % de un núcleo** |
| CPU de Postgres | — | **~980 % (los 10 núcleos)** |
| Errores | 0 | 0 |

Un pedido a la vez, sobre la base grande (cinco repeticiones): portada 58 ms · categorías 1 ms · búsqueda con texto 15–63 ms · sugerencias 36–50 ms · «Wilson» 70 ms · mapa del sitio 109 ms · ficha 4–8 ms · **búsqueda sin texto (todo el catálogo) 1 235 ms**.

**Qué dicen estos números**

- La API respondió 2 071 pedidos por segundo cuando la base era chica: **Node no es el límite**. Con la base grande, Postgres se satura y arrastra todo, incluso la ficha (que sola tarda 5 ms) porque espera turno.
- Las pruebas de la API con pocas IPs frente a muchas muestran que el limitador **cuesta memoria** (H7), y la prueba de ingreso del 09/11 ya había visto la API subir a ~500 MB con 20 ingresos a la vez (H6): en producción el tope es 448 MB.
- Carga esperada hoy: unas 200 tiendas a ~10 pedidos por minuto son **~33 pedidos por segundo** (cálculo de `shared/limites.ts`). Aun diez veces más (330) está por debajo de lo que la API sostiene si la base no es el límite.

**Límites de la medición:** datos sintéticos (títulos al azar, 6 tiendas), una sola máquina para carga y servidor, la prueba de memoria (H7) se hizo con `tsx` y no con el build. Sirven para ordenar prioridades, no para prometer cifras en el VPS: hay que repetirlas en *staging*.

## 4. Defensa por capas

Hay tres clases de ataque y cada una la frena una capa distinta. Conviene no mezclarlas:

| Clase | Ejemplo | La frena |
|---|---|---|
| **Volumen de red** (capas 3 y 4) | Inundar la IP con paquetes | Solo Cloudflare, **y solo si la IP del origen no se conoce** (ver §4.1, punto «IP del origen») |
| **Inundación HTTP y bots** (capa 7) | Miles de pedidos a `/v1/buscar`, scraping, relleno de credenciales | Cloudflare (caché, reglas, límite de tasa, Turnstile) + nginx + la aplicación |
| **Agotar recursos con pedidos legítimos** | Búsquedas caras, ingresos con argon2, subidas, sockets abiertos | **Solo la aplicación y la base** (Cloudflare no sabe que una búsqueda es cara) |

### 4.1 Cloudflare

**Qué da cada plan** (consultado en la documentación oficial el 11/11/2026; los precios hay que confirmarlos al contratar):

| | Gratis | Pro (≈ US$ 20–25/mes) |
|---|---|---|
| DDoS capas 3, 4 y 7 | Sí, sin medidor | Sí |
| Reglas de WAF propias | 5 | 20 |
| Conjuntos de reglas administrados | Solo el *Free Managed Ruleset* | + *Managed Ruleset* completo + **OWASP Core** (el que trae las reglas de inyección SQL/XSS) |
| Límite de tasa | **1 regla**, ventana 10 s, bloqueo 10 s, por IP | 2 reglas, ventana hasta 1 min, bloqueo hasta 1 h |
| Caché, Turnstile, WebSockets, HTTP/3 | Sí | Sí |

**Recomendación:** empezar en **Gratis**. La inyección SQL no es la amenaza principal (§1.3) y el límite de tasa gratis es corto, así que el ingreso se protege con la aplicación + Turnstile. Pasar a **Pro** cuando haya tráfico real o un cliente pida OWASP Core.

**Orden de activación (importa):**

1. **Primero nginx, después el DNS.** Con Cloudflare delante, la IP que ve nginx es la de Cloudflare. Hay que agregar en el bloque de `paselibre.shop`: `set_real_ip_from <rangos de Cloudflare>; real_ip_header CF-Connecting-IP; real_ip_recursive on;`. Sin esto, **todas las tiendas y visitantes compartirían el límite de unas pocas IPs de Cloudflare y se bloquearían entre sí** (H8). Los rangos se bajan de `cloudflare.com/ips-v4` y `/ips-v6` y se actualizan con un cron. **Preparado (12/11):** `tools/deploy/scripts/cloudflare-ip.sh` genera `/etc/nginx/snippets/paselibre-cloudflare-ip.conf` (22 rangos hoy; solo cree `CF-Connecting-IP` si el pedido viene de Cloudflare, así que no cambia nada mientras no esté delante), `tools/deploy/cron/paselibre-cloudflare-ip` lo renueva los lunes y el ejemplo de nginx ya lo incluye, junto con la ruta de renovación del certificado también por HTTPS. En producción se aplica con un solo guion de respaldo + `nginx -t` + recarga.
2. Agregar el sitio en Cloudflare, copiar los registros DNS, cambiar los *nameservers* en Spaceship. Dejar anotado el valor anterior para volver.
3. Registros `@` y `www` en modo **proxy** (nube naranja). SSL/TLS en **Full (strict)** (el origen ya tiene certificado de Let's Encrypt válido). «Always use HTTPS», TLS mínimo 1.2, HTTP/3 activado. **No** activar *Rocket Loader* ni *Auto Minify* (pueden romper la hidratación de Next).
4. Probar: portada, ingreso, chat (WebSocket en `/tiempo-real`), subir una foto, y `certbot renew --dry-run` (la renovación pasa por el proxy).
5. **Reglas de caché** (la API ya manda `Cache-Control: public, max-age=60` a los visitantes):
   - `/_next/static/*` y `/media/*`: elegibles, TTL largo (son inmutables).
   - Lecturas públicas de la API (`/v1/portada`, `/v1/categorias`, `/v1/galerias`, `/v1/buscar*`, `/v1/productos/*`, `/v1/mapa-del-sitio`) **solo si no hay cookie de sesión**: expresión `http.request.method eq "GET" and not http.cookie contains "pl_sesion" and (starts_with(http.request.uri.path, "/v1/portada") or starts_with(http.request.uri.path, "/v1/categorias") or starts_with(http.request.uri.path, "/v1/galerias") or starts_with(http.request.uri.path, "/v1/buscar") or starts_with(http.request.uri.path, "/v1/productos/") or starts_with(http.request.uri.path, "/v1/mapa-del-sitio"))`, TTL del encabezado del origen (solo esas rutas, no todo `/v1/`). **No confiar en `Vary: Cookie`**: Cloudflare ya sabe variar por encabezado en sus reglas de caché, pero su documentación no dice qué hace con `Cookie`, así que la condición explícita «sin cookie» es la forma segura (y no configurar `bypass` para `Cookie`: todas nuestras respuestas públicas llevan `Vary: Origin, Cookie` y dejarían de guardarse). **Probar con y sin cookie** y mirar `cf-cache-status` (`HIT` sin cookie; `BYPASS`/`DYNAMIC` con cookie): si un visitante recibiera la versión con precios de una tienda, se rompería la regla de privacidad más delicada de todo el plan.
   - No usar «Cache Everything» global: las páginas de Next llevan `no-store` y deben seguir así.
6. **Reglas de WAF propias** (5 gratis), por ejemplo:
   - *Bloquear sondeos*: `http.request.uri.path contains "/.env" or contains "/.git" or contains "/wp-" or contains "phpmyadmin" or contains "xmlrpc.php"`.
   - *Desafío fuera de Perú* solo para las entradas sensibles: `(http.request.uri.path in {"/ingresar" "/registro"} or starts_with(http.request.uri.path, "/v1/sesion") or starts_with(http.request.uri.path, "/v1/registro")) and ip.src.country ne "PE"` → *Managed Challenge* (no bloquear: hay socios y equipo que viajan).
7. **Límite de tasa** (la regla gratis): `starts_with(http.request.uri.path, "/v1/")`, umbral **alto** (p. ej. 300 pedidos / 10 s por IP) porque una galería entera sale por una IP. Es una red de seguridad, no el límite fino: ese sigue en la aplicación.
8. **Turnstile** en «Ingresar», «Registro» y «Pedir mi cuenta», con verificación del token en la API.
9. *Bot Fight Mode* en prueba: puede estorbar a clientes legítimos de la API; revisar el panel de eventos la primera semana.
10. Alertas de Cloudflare (ataque DDoS detectado, certificado por vencer) al correo del equipo. Y el interruptor de emergencia: **«Under Attack Mode»**.

**IP del origen.** Cloudflare solo protege de la inundación de red si nadie conoce la IP real. Aquí está expuesta: el DNS actual la publica y el mismo servidor sirve otros dominios (ecabot, Yallegó) que normalmente apuntan a ella. Opciones, de menos a más trabajo:

- **A (mínima):** en el bloque de `paselibre.shop`, `allow` solo de los rangos de Cloudflare y `deny all`. Lo que llegue directo a la IP recibe 403, aunque siga gastando conexión TLS. No frena una inundación de red.
- **B (mejor):** **Cloudflare Tunnel** (`cloudflared`): el servidor abre una conexión saliente y `paselibre.shop` ya no necesita puertos abiertos; el tráfico solo entra por Cloudflare. El resto de dominios del servidor no cambian.
- **C (definitiva):** una IP propia para PaseLibre (o un VPS propio, que además resuelve H10) y que nadie más la conozca.
- Preguntar a ReliableSite qué protección contra DDoS de red incluye el VPS.

### 4.2 nginx (servidor)

Cambios acotados al bloque de `paselibre.shop` (las zonas van en `http {}`, en un archivo de `conf.d`, sin efecto sobre los otros sitios), salvo `worker_connections`, que es global:

```nginx
# conf.d/paselibre-limites.conf
limit_req_zone  $binary_remote_addr zone=pl_api:10m   rate=60r/s;   # una galería entera sale por una IP: no bajar mucho
limit_req_zone  $binary_remote_addr zone=pl_login:10m rate=20r/m;
limit_conn_zone $binary_remote_addr zone=pl_conn:10m;
limit_req_status 429;
```

```nginx
# dentro de server { ... } de paselibre.shop
client_header_timeout 10s;  client_body_timeout 15s;  send_timeout 30s;  keepalive_timeout 30s;
# client_max_body_size 9m;  (se queda como está para la web y /media)

location ^~ /v1/ {
    client_max_body_size 256k;                          # JSON chico; las subidas tienen su ruta exacta abajo
    limit_req  zone=pl_api burst=120 nodelay;
    limit_conn pl_conn 60;
    # ... proxy como hoy
}
location = /v1/sesion        { limit_req zone=pl_login burst=5 nodelay; client_max_body_size 8k; ... }   # entrar (POST) y salir (DELETE)
location = /v1/archivos      { client_max_body_size 9m;  ... }   # fotos (MAX_BYTES_FOTO = 8 MB)
location = /v1/equipo/catalogo/importar { client_max_body_size 41m; ... }   # corrige H4
```

Además: `worker_connections 4096` (antes 768; cada WebSocket gasta dos conexiones; systemd ya da 524 288 descriptores, así que no hace falta `worker_rlimit_nofile`). `ssl_session_cache` ya lo pone el archivo de certbot. Queda para después: registro con `$request_time` y `$upstream_response_time`.

**Aplicado en producción (fase 0, 11/11/2026, 23:38 de Lima).** Lo de arriba está en `/etc/nginx/sites-available/paselibre.shop` (las zonas al inicio del archivo, como ya hacía `ops.ecabot.site`) y `worker_connections 4096` en `nginx.conf`; el ejemplo del repo (`tools/deploy/nginx/paselibre.conf.example`) quedó igual. Respaldo de los dos archivos anteriores en `/var/backups/nginx/fase0-20261112T043828Z/`. Para volver atrás, dentro del servidor: copiar `nginx.conf` y `paselibre.shop` de esa carpeta a su lugar y `nginx -t && systemctl reload nginx`.

Verificación: los 7 sitios del servidor responden igual que antes (PaseLibre, linerook, ecabot ×5); prueba de humo completa; socket del chat, búsqueda, portada e ingreso responden; «Importar catálogo» con 12 MB llega a la API y 42 MB da 413; foto de 9,5 MB da 413 y de 300 KB llega; JSON de 300 KB a `/v1/ofertas` da 413; 30 ingresos seguidos desde una IP: 11 pasan y 19 reciben 429; 600 pedidos multiplexados a `/v1/salud` desde una IP: 139 pasan y 461 reciben 429, y otra IP sigue entrando sin problema. Los únicos errores nuevos en el registro de nginx son esas pruebas de 413.

### 4.3 El servidor

- **CrowdSec** (o `fail2ban`) con los casos de SSH y de nginx: bloquea IPs que sondean o fallan. Con Cloudflare delante, el bloqueo de HTTP se hace en Cloudflare (CrowdSec tiene integración), el de SSH en el firewall.
- **`unattended-upgrades`** solo de seguridad, y un plan para pasar de Debian 12 a 13.
- **SSH**: ya es solo por llave. Siguiente paso: cerrar el 22 a internet y entrar por **Tailscale/WireGuard**.
- **Respaldos fuera del servidor** (H11): Cloudflare R2 (10 GB gratis) o Backblaze B2, con `rclone`; el script ya lo soporta (`RCLONE_DESTINO`).
- **Monitoreo**: el servidor ya tiene algo escuchando en `127.0.0.1:9090` y `:9093` (los puertos típicos de Prometheus y Alertmanager; no verifiqué de quién es); si lo son, sumar una sonda a `paselibre.shop/v1/salud` y alertas de CPU, memoria y reinicios de contenedores. Una prueba de «caído» externa (Uptime Kuma o similar) para el caso en que se caiga todo el servidor.

### 4.4 La aplicación y la base (lo que Cloudflare no cubre)

Ordenado por retorno:

1. **Búsqueda (H5).** Hipótesis a medir con `tools/carga`, de menos a más trabajo: (a) caché de 30–60 s para visitantes, por pregunta normalizada y con una sola consulta en curso por clave (ya existe `shared/memoria.ts`); (b) calcular totales y lista en **una** consulta, no dos; (c) tabla/vista materializada con la «mejor oferta» de cada producto, que se actualiza al publicar; (d) tope de profundidad de página y de palabras. Meta: volver a ≥ 500 pedidos/s con el catálogo grande.
2. **Postgres.** `statement_timeout` (p. ej. 8 s) por rol para que una consulta mala no acapare núcleos; `pg_stat_statements` para ver las más caras; hoy el contenedor tiene 256 MB y el catálogo grande (130 MB) ya no cabe cómodo con `shared_buffers` de 128 MB. Y **fallar rápido**: `pool_timeout=20` deja una fila de 20 s; mejor devolver 503 con `Retry-After` pasado un umbral.
3. **Ingreso (H6).** Máximo 2 verificaciones argon2 a la vez (un semáforo) y cola corta; bloqueo temporal por **cuenta** además de por IP; Turnstile. Mientras tanto, subir el tope de memoria de la API (hoy 448 MB).
4. **Limitador (H7).** Mantener los límites finos en la aplicación pero con almacenamiento acotado (o Redis cuando haya más de una réplica); los gruesos pasan a Cloudflare y nginx.
5. **CSP en la web (H9)** y `keepAliveTimeout` de Node por encima del de nginx (evita 502 esporádicos).
6. **Autorización.** El riesgo real no es la inyección sino la lógica: que una tienda vea o toque datos de otra (BOLA/IDOR). Una matriz de pruebas «cada ruta con cada rol y con el recurso de otra tienda», más **OWASP ZAP** en modo base contra *staging*.
7. **Dependencias y secretos.** `pnpm audit`, Dependabot o Renovate, **Trivy** sobre las imágenes, **gitleaks** sobre el historial (el repositorio es público).

### 4.5 Si hay un ataque (guía corta)

1. Cloudflare → *Security* → **Under Attack Mode** (desafío a todos). 2. Revisar *Security Events* y bloquear el patrón (país, ruta, *user-agent*). 3. Bajar el umbral del límite de tasa. 4. Si es la búsqueda, apagar temporalmente `EN_VIVO` y pedir cuenta para buscar. 5. `docker stats` y `docker logs --tail` del servidor. 6. Después: qué se vio y qué regla faltaba.

## 5. ¿Migrar a Go o Rust?

**Respuesta corta: no ahora.** Ni a Go ni a Rust, porque la evidencia dice que el lenguaje no es lo que limita.

**Los datos propios**

- Con base chica la API (Node + NestJS + Prisma) llegó a **2 071 pedidos/s** (09/11) y, en otra prueba mía en modo desarrollo con 150 usuarios a la vez, a 2 126/s con p95 de 83 ms y sin errores. La carga esperada es ~33/s.
- Con base grande, Postgres consume ~980 % de CPU y la API 8–26 % de **un** núcleo: **menos del 3 % de la CPU total**. Si la API fuera infinitamente rápida, el sistema mejoraría menos del 3 %. Lo que hay que arreglar son las consultas (§4.4).
- Es la ley de Amdahl: acelerar la parte que no es el cuello no mueve el resultado.

**Qué cambiaría un lenguaje más ligero (sí tiene ventajas, pero otras).** Las cifras de Go y Rust son estimaciones generales, **no medidas aquí**:

| | Node/NestJS (hoy) | Go | Rust |
|---|---|---|---|
| Memoria por proceso (orden de magnitud, no medido aquí) | ~160 MB hoy en producción | decenas de MB | decenas de MB, a veces menos |
| Pedidos por núcleo en trabajo propio de la API | bueno (2 000+/s medidos) | 2–5 veces más | 2–6 veces más |
| Tiempo hasta reescribir lo que hay | — | meses | meses, más lento de escribir y compilar |
| Contratos compartidos con la web (Zod, TypeScript) | **sí**, un solo tipo para todo | se pierde: habría que generarlos (OpenAPI) | ídem |
| Socket.io (chat, campanita) | nativo | bibliotecas menos mantenidas | `socketioxide`, sólida |
| Consultas a Postgres | Prisma | `pgx`/`sqlc`, excelente | `sqlx`, excelente |

La ventaja real y concreta de Go/Rust aquí es la **memoria** en un VPS de 3,9 GB compartido. Se puede ganar bastante de eso sin reescribir, con las medidas de abajo.

**Costo de una reescritura**: 14 000 líneas de API, 28 migraciones y 44 modelos de Prisma, 7 000 líneas de pruebas, los contratos compartidos con una web de 30 000 líneas, y un equipo chico. Son meses sin entregar funciones, con riesgo de regresiones en privacidad (lo que ve un visitante) que hoy cubren las pruebas.

**Antes de pensar en otro lenguaje, en este orden (cada paso se mide con `tools/carga`):**

1. Cloudflare + nginx (§4.1–4.2).
2. Arreglar la búsqueda y la base (§4.4, puntos 1–2).
3. Fastify en lugar de Express (NestJS lo admite) y consultas calientes con `pg` directo en lugar de Prisma.
4. Un VPS propio para PaseLibre (hoy comparte 2 núcleos y 3,9 GB con otros cuatro proyectos) o más RAM.
5. Dos réplicas de la API detrás de nginx, con Redis para los límites y el adaptador de socket.io.

**Cuándo sí volver a evaluarlo (disparadores medibles, no corazonadas):**

- La CPU de la API pasa del 70 % de un núcleo **de forma sostenida** con la base ya optimizada y con dos réplicas.
- Más de ~5 000 sockets abiertos a la vez, o más de ~500 pedidos dinámicos por segundo sostenidos.
- La memoria de la API obliga a comprar un servidor más grande solo por eso.

**Si llegara el momento, no reescribir todo**: mover **solo** lo caliente (la búsqueda o la puerta de entrada del tiempo real) a un servicio aparte detrás del mismo nginx, mientras lo demás sigue en NestJS (patrón «estrangulador»). **Go** sería mi elección para este equipo (rápido de escribir y de contratar, buena base de datos y concurrencia); **Rust** solo si la memoria o la latencia en cola (p99) pasaran a ser el problema número uno.

## 6. Hoja de ruta propuesta

| Fase | Qué | Esfuerzo | Riesgo | Resuelve |
|---|---|---|---|---|
| **0** | ✅ nginx (11/11): `client_max_body_size` por ruta, tiempos de espera, `limit_req`/`limit_conn`, `worker_connections`. Falta: `unattended-upgrades` y CrowdSec/`fail2ban` para SSH | ½ día | Bajo (recargar nginx; hay marcha atrás) | H2, H4 · falta H3 |
| **1** | Cloudflare gratis: primero `real_ip` en nginx (preparado el 12/11), después DNS, reglas de caché con cookie, WAF, límite de tasa, Turnstile; después restringir el origen (opción A/B de §4.1) | 1 día | Medio (caché con cookie: probar con y sin sesión) | H1, H8 |
| **2** | La búsqueda y la base: caché de visitantes, una sola consulta, tabla resumen, `statement_timeout`, 503 con `Retry-After`; volver a medir | 2–4 días | Medio (cuidar la regla de privacidad: ningún precio al visitante) | H5 |
| **3** | Ingreso con semáforo y bloqueo por cuenta, CSP, limitador acotado, ZAP/Trivy/gitleaks en CI | 2 días | Bajo | H6, H7, H9 |
| **4** | Respaldos externos, monitoreo externo, VPS propio o más RAM, dos réplicas con Redis | según crecimiento | Bajo–medio | H10, H11 |
| **5** | Solo si se cumplen los disparadores de §5: servicio aparte en Go para lo caliente | semanas | Alto | — |

## 7. Cómo repetir las mediciones

Todo está en `tools/carga` (ver su README): `carga.mjs` (escenarios), `catalogo-grande.sql` (60 mil productos y 180 mil ofertas), `tiempos.sh` (cada ruta, una a la vez) e `ips.js` (memoria del limitador). **Solo contra una API local**: mandan miles de pedidos por segundo con IPs inventadas en `X-Forwarded-For`, algo que en producción nginx no deja pasar. Repetir las pruebas en *staging* antes de fijar cifras para el VPS.

## 8. Lo que no se revisó

- Los registros de acceso de producción (IPs, *user-agents*, volumen de escaneos): no los leí; si se quieren, se revisan en conjunto y sin sacar datos personales del servidor.
- El flujo de «Importar catálogo» y el resto de pantallas **dentro** de producción (no se entra con cuentas reales).
- Los otros proyectos del servidor (Yallegó, ecabot, linerook) más allá de verlos en `docker stats` y en nginx.
- Los precios y límites de Cloudflare cambian: se consultaron hoy en su documentación; confirmarlos al contratar.
