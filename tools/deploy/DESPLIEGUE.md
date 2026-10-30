# Despliegue en un servidor

Cumple docs/05 §10: Docker Compose en un VPS, nginx del servidor con Let's Encrypt, *staging* y producción con bases separadas (RNF-33). El patrón viene del de Yallegó: construir, respaldar, migrar, cambiar las imágenes y hacer una prueba de humo.

## Qué hay

| Archivo | Para qué |
| --- | --- |
| [`compose.yml`](compose.yml) | Postgres 16, las migraciones, la API y la web. Solo la API y la web publican un puerto, y solo en `127.0.0.1` |
| [`despliegue.env.example`](despliegue.env.example) | Variables de un entorno. Se copia fuera del repositorio, con permisos 600 |
| [`nginx/paselibre.conf.example`](nginx/paselibre.conf.example) | nginx del servidor: `/v1` y `/tiempo-real` a la API, `/media` desde la carpeta de fotos, el resto a la web |
| [`scripts/desplegar.sh`](scripts/desplegar.sh) | Construye, respalda, migra, cambia las imágenes y corre la prueba de humo. También revierte |
| [`scripts/humo.sh`](scripts/humo.sh) | La prueba de humo, vista desde afuera |
| [`scripts/cuenta-equipo.sh`](scripts/cuenta-equipo.sh) | La primera cuenta del equipo, donde no hay semilla de demostración |
| [`scripts/semilla-demo.sh`](scripts/semilla-demo.sh) | Los datos de demostración del lienzo, solo en *staging* |
| [`../../apps/api/Dockerfile`](../../apps/api/Dockerfile), [`../../apps/web/Dockerfile`](../../apps/web/Dockerfile) | Las imágenes: `paselibre-api`, `paselibre-migraciones` y `paselibre-web` |

Los respaldos y su cron están en [RESPALDOS.md](RESPALDOS.md).

```
Internet ─ nginx (443) ─┬─ /media/      ─ carpeta de fotos (MEDIA_DIR)
                        ├─ /v1/ y /tiempo-real ─ 127.0.0.1:API_HOST_PORT ─ api ─┐
                        └─ /            ─ 127.0.0.1:WEB_HOST_PORT ─ web ─(llama a la api por la red de compose)
                                                                         postgres ─┘
```

Redis no está: la API todavía no lo usa (no hay cola de tareas ni más de un proceso). Se agrega al compose cuando haga falta.

## 1. Preparar el servidor

Ubuntu o Debian con acceso por SSH. Una sola vez:

```bash
# Docker con el plugin de compose, nginx, certbot y git
apt-get update && apt-get install -y docker.io docker-compose-v2 nginx certbot git rclone
systemctl enable --now docker nginx

# El código y la configuración (los secretos viven fuera del repositorio)
install -d -m 755 /opt/paselibre /opt/paselibre/config
git clone https://github.com/DazzleEaglePe/pase-libre.git /opt/paselibre/app
install -d -m 755 /var/www/certbot
```

Cortafuegos: solo 22, 80 y 443. Postgres, la API y la web no se abren; ya escuchan solo en `127.0.0.1`.

Dominio: un registro `A` por entorno (por ejemplo `staging.…` y el dominio raíz) apuntando a la IP del servidor.

## 2. El archivo de entorno

```bash
cp /opt/paselibre/app/tools/deploy/despliegue.env.example /opt/paselibre/config/staging.env
chmod 600 /opt/paselibre/config/staging.env
```

Se completa `ENTORNO` (`staging` o `produccion`), `PUBLIC_URL`, `POSTGRES_PASSWORD` (`openssl rand -hex 24`), `MEDIA_DIR` y los puertos. Si staging y producción comparten servidor: puertos distintos (3100/3101 y 3110/3111, por ejemplo), `MEDIA_DIR` distinto y cada uno con su archivo. Los valores no llevan espacios ni comillas: los lee `sh`.

La carpeta de fotos la crea quien despliega, con el dueño de la API (uid 1000):

```bash
install -d -o 1000 -g 1000 -m 755 /var/lib/paselibre/staging/media
```

## 3. nginx y certificado

```bash
cp /opt/paselibre/app/tools/deploy/nginx/paselibre.conf.example /etc/nginx/sites-available/paselibre-staging
# Cambiar el dominio, los puertos y la ruta de /media; ver los CAMBIAR del archivo
```

El certificado se pide antes de activar el bloque `443`, porque nginx no arranca sin sus archivos. Primero se activa solo el bloque del puerto 80 (se borra el bloque `443` de la copia, o se comenta):

```bash
ln -s /etc/nginx/sites-available/paselibre-staging /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/certbot -d staging.paselibre.example
# Ahora se restaura el bloque 443
nginx -t && systemctl reload nginx
```

`certbot` renueva solo (timer de systemd). Los certificados se comprueban con `certbot renew --dry-run`.

## 4. Primer despliegue

```bash
cd /opt/paselibre/app
./tools/deploy/scripts/desplegar.sh /opt/paselibre/config/staging.env
```

Construye las imágenes con la etiqueta del commit, levanta Postgres, aplica las migraciones y la semilla base (galerías, categorías y marcas; no pisa lo que ya existe), pone en marcha la API y la web y termina con la prueba de humo contra `PUBLIC_URL`. El repositorio tiene que estar limpio y en el commit que se quiere publicar (`git pull` antes).

Primera cuenta del equipo (donde no hay semilla de demostración):

```bash
./tools/deploy/scripts/cuenta-equipo.sh /opt/paselibre/config/produccion.env --usuario dazz --nombre "Dazz"
```

Muestra una clave temporal una sola vez. Con esa cuenta se entra a `/equipo/cuentas` y desde ahí se crean las demás.

*Staging* con los datos de demostración del lienzo (nunca en producción):

```bash
# CLAVE_DEMO en el archivo de entorno: 12 caracteres o más y distinta de la del repositorio, que es pública
./tools/deploy/scripts/semilla-demo.sh /opt/paselibre/config/staging.env
```

## 5. Despliegues siguientes

```bash
cd /opt/paselibre/app && git pull
./tools/deploy/scripts/desplegar.sh /opt/paselibre/config/produccion.env
```

Antes de migrar respalda la base con `RESPALDO_ENV` (si ya hay una base y falta, se detiene). Si algo falla en la prueba de humo, el script dice cómo volver: la etiqueta anterior queda en `IMAGEN_TAG_ANTERIOR`.

```bash
# Volver a la versión anterior (imágenes que ya están en el servidor)
./tools/deploy/scripts/desplegar.sh /opt/paselibre/config/produccion.env <etiqueta>
```

**Las migraciones solo avanzan.** Revertir las imágenes no deshace una migración; por eso cada migración tiene que ser compatible con la versión anterior del código (agregar, no quitar). Si una migración rompe algo, se restaura el respaldo que el script hizo antes ([RESPALDOS.md](RESPALDOS.md)).

Las imágenes viejas ocupan disco. Cuando haga falta espacio: `docker image ls 'paselibre-*'` y `docker rmi` de las etiquetas que ningún entorno usa.

## 6. Respaldos y monitoreo

- **Respaldos:** copiar `respaldo.env.example` a `/opt/paselibre/config/respaldo.env` (con `COMPOSE_ENV_FILE` apuntando al archivo de entorno de ese entorno), instalar el cron y ensayar la restauración en *staging* antes de salir. Todo en [RESPALDOS.md](RESPALDOS.md).
- **Monitor externo (RNF-39):** un monitor gratuito (UptimeRobot, Better Stack…) que pida `https://<dominio>/v1/salud/lista` cada minuto y avise por correo. Responde 200 si la base contesta y 503 si no.
- **Registros:** `docker compose --env-file <entorno.env> -f tools/deploy/compose.yml logs -f api`. Son JSON de pino y rotan solos (10 MB × 5).

## Notas de seguridad

- Las cookies de sesión son `Secure`: sin HTTPS no se puede ingresar. La API en producción se niega a arrancar sin eso.
- `PROXIES_DE_CONFIANZA=uniquelocal` deja que la API lea la IP real del cliente en `X-Forwarded-For`. nginx **pisa** esa cabecera con `$remote_addr`, así que un cliente no puede inventar su IP para saltarse los límites.
- Postgres, la API y la web escuchan solo en la red de compose o en `127.0.0.1`.
- `EN_VIVO` (busco y ofertas flash, D-53) va en `false` hasta que se decida encenderlo. Cambiarlo solo pide reiniciar la API.
- El archivo de entorno tiene la contraseña de la base: permisos 600 y fuera del repositorio.

## Probado en local (28/10/2026)

Con Docker en la máquina de desarrollo, un entorno `ensayo` completo (puertos 3190 y 3191) y un nginx de prueba con la plantilla adaptada (sin TLS):

- **Primer despliegue:** `desplegar.sh` construyó las tres imágenes, creó la base, aplicó las 4 migraciones, la semilla base y puso en marcha la API y la web, todo sano.
- **Prueba de humo a través de nginx:** pasan las 10 comprobaciones, incluidas la portada del visitante sin precio ni tienda, el ingreso y la salida con una cuenta de prueba, y el socket del chat.
- **WebSocket real:** un cliente de socket.io con la cookie de sesión conectó por `websocket` a través de nginx y recibió `tiempo-real:listo`.
- **Fotos:** subir una por `/v1/archivos` la guardó en la carpeta del servidor y nginx la entregó en `/media/…` con `immutable` y sin pasar por la API.
- **Segundo despliegue:** sin `RESPALDO_ENV` se detiene ("no migro sin respaldo"); con él, respalda la base antes de migrar y deja la etiqueta anterior para revertir.
- **Revertir:** `desplegar.sh <env> <etiqueta anterior>` volvió a las imágenes viejas en segundos.
- **Respaldo y ensayo de restauración** con `COMPOSE_ENV_FILE`: restauraron en una base aparte y las 8 tablas coincidieron.
- **Cuentas:** `semilla-demo.sh` (con `CLAVE_DEMO` propia) y `cuenta-equipo.sh` funcionaron dentro del contenedor de migraciones.

**Falta, porque depende del servidor** (se repite en *staging* antes de salir):

- Los permisos de la carpeta de fotos (uid 1000) y el `alias` de `/media`: en local no se prueban.
- TLS con Let's Encrypt y la cabecera `X-Forwarded-For` real (límites por IP con la IP verdadera del cliente).
- El cron de respaldos y la copia a B2.
- El monitor externo.
