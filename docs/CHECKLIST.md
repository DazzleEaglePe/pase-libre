# Checklist de la primera salida

**Fecha:** miércoles 28/10/2026 · **Meta:** PaseLibre en línea el sábado 31/10 · **Última revisión del código:** commit `7382d4c`, con la CI en verde

Mapa de lo que está hecho y de lo que falta, para ir marcando casillas. Cada bloque dice **quién** lo hace. Las casillas marcadas ya están hechas y verificadas; las vacías no.

- **Bloquea** = sin esto no se puede salir el 31/10.
- **Antes de salir** = se espera para el 31/10, pero no impide la salida si falta.
- **Fase 2** = ya decidido que queda para después.

**Ruta crítica:** VPS y dominio → *staging* → ensayo completo → carga del piloto (vie 30/10) → producción (sáb 31/10). Sin servidor no hay *staging*, y sin *staging* la salida no tiene ensayo previo.

---

## 1. Desarrollo · lo que ya está hecho

Detalle día por día en [05 · Arquitectura §12](05-arquitectura.md#12-plan-de-construcción-al-3110).

- [x] Monorepo, base de datos, semilla, sesión y primer ingreso (día 1)
- [x] Catálogo público, búsqueda con corrección, ficha por audiencia y prueba de contrato público (día 2)
- [x] Panel del equipo: crear cuentas, reenviar acceso, suspender y reactivar (día 2)
- [x] Publicar, «Publicar uno igual», fotos y Mis publicaciones (día 3)
- [x] Mensajes en tiempo real, campanita, bloqueo, denuncia y «Vendido» (día 4)
- [x] Configuración, límites por IP y por persona, y scripts de respaldo (día 5)
- [x] Traspasar publicaciones y conversaciones entre cuentas (A-11, RF-71)
- [x] Parte pública de la web: portada, resultados y ficha
- [x] Marca Hielo: símbolo, logos, íconos, hoja de marca y tokens en la web
- [x] CI en GitHub Actions: formato, lint, tipos, pruebas con Postgres y *build*
- [x] Kit de despliegue: Dockerfiles, `compose.yml`, nginx, `desplegar.sh`, `humo.sh`, `cuenta-equipo.sh` y `semilla-demo.sh`
- [x] Kit de despliegue probado en local: nginx, WebSocket, fotos en `/media`, respaldo previo, reversión y ensayo de restauración
- [x] El punto de control del plan B del 29/10 se cumple en local: el chat funciona, así que sale

## 2. Desarrollo · lo que falta

**Dazz**

- [x] El pie de página lleva a Ayuda, Términos y Privacidad (28/10). «Libro de Reclamaciones» sigue sin enlace (ver bloque 4)
- [x] `sitemap.xml` y `robots.txt` (RNF-42), con la ruta `GET /v1/mapa-del-sitio`. Solo producción se deja indexar; *staging* y local responden `Disallow: /` (28/10)
- [x] La web recibe `WEB_URL` y `ENTORNO` en `compose.yml`: sin eso, la vista al compartir habría salido con `localhost` en producción (28/10)
- [ ] **Antes de salir:** revisar en la web lo que quedó sin verificar: el orden, la paginación, el filtro de precio, el clic de WhatsApp y la vista del equipo
- [ ] **Antes de salir:** una forma de cargar el piloto sin publicar uno por uno. La carga en bloque (RF-34) pasó a la fase 2, así que o cada vendedor publica a mano o se escribe un script chico a partir de la plantilla del bloque 4
- [ ] **Antes de salir:** decidir qué hacer con las denuncias. Se guardan en la tabla `Denuncia`, pero el equipo no tiene dónde verlas (RF-28, RNF-53). Mínimo: una consulta SQL documentada en la guía del equipo
- [ ] **Antes de salir:** unir productos duplicados (RF-54). La base tiene `fusionado_en_id` y la web redirige con 301, pero el equipo no puede unirlos. Mínimo: un script
- [ ] Reporte de uso (RF-31, RF-32): las tablas `Busqueda` y `Contacto` existen; falta la consulta lista, una por semana y galería
- [ ] Averiguar por qué `limites.e2e-spec` falla una vez de cada tantas corridas («socket hang up»), para que la CI no dé falsos rojos
- [ ] Ajuste de forma de Hielo: botones de 10 px y tarjetas de 12 px (hoy son píldoras)
- [ ] **Fase 2:** perfil privado, «Quién puede escribirte», respuesta automática, idioma y aviso por correo en Configuración
- [ ] **Fase 2:** registro propio con aprobación, precio por rol, requerimientos, pedir pase, preguntas públicas, reputación, favoritos, tienda pública, notificaciones y la app

## 3. Diseño

**Grimm y My**

- [ ] Pasar el lienzo de diseño de Inter y lima a Hielo (Figtree, azul noche, azul pase y grises fríos). La web ya está en Hielo y el lienzo quedó atrás
- [ ] Revisar la web en celular, en las pantallas de la primera salida, y avisar de lo que se vea mal
- [ ] Cerrar la pregunta sobre la maquetación de Grimm (pendiente 8 del [04](04-decisiones-para-la-reunion.md)): la web se construyó desde el lienzo, así que probablemente ya no aplica

## 4. Documentos

**Hechos el 28/10**

- [x] **06 a 12:** modelo de datos, contrato de la API, seguridad y autenticación, UX y flujos, design system, plan de desarrollo y estructura del proyecto, revisados contra el código
- [x] **05 · Arquitectura** queda como resumen, con enlaces a los documentos nuevos y A-03, A-04 y A-08 corregidas (Redis y cola no se usan; fotos en una sola versión)
- [x] **README:** estado al 28/10, tabla de documentos y próximos pasos

**Para actualizar**

- [ ] **04 · Decisiones y pendientes:** sigue en v0.6 («hoy es domingo 25/10»). Pasar a «Ya decidido» lo que ya se resolvió (marca, bandeja por persona, plazo) y revisar la tabla de pendientes
- [ ] **01 · Contexto §9.2:** varias de las 14 preguntas abiertas ya se cerraron (plan B, recortes, perfil privado, aviso por correo)
- [ ] **05 · Arquitectura §14:** las decisiones pendientes (servidor, dominio, maquetación) se actualizan al decidir
- [ ] Subir la versión de 01, 02 y 03 (siguen en v0.8 del 26/10) al cerrar lo anterior

**Para escribir**

- [x] **Borradores de Términos, Privacidad y Ayuda** en `/terminos`, `/privacidad` y `/ayuda` (28/10). Cada página avisa que es un borrador; se apaga con `BORRADOR` en `features/informacion/documento.tsx`
- [ ] **Bloquea · Fabrizio:** quién responde legalmente por PaseLibre (nombre o razón social, RUC, domicilio y correo). Las páginas lo muestran como «[por definir]»; se completa en `RESPONSABLE` de `documento.tsx`
- [ ] **Revisar los borradores** de Términos y Privacidad con alguien que conozca la Ley 29733, y la Ayuda con el equipo. Después, apagar `BORRADOR`
- [ ] Al borrar una cuenta a pedido, borrar también sus fotos de la copia en B2: el respaldo las copia sin borrar nunca nada allá ([RESPALDOS.md](../tools/deploy/RESPALDOS.md)), y la política de privacidad promete eliminarlas
- [ ] **Libro de Reclamaciones:** el diseño ya lo muestra. Averiguar si aplica a una plataforma gratuita entre tiendas y, si no, quitarlo del pie
- [ ] **Guía del equipo:** crear cuentas, reenviar acceso, claves olvidadas, traspasar, unir duplicados, revisar denuncias y suspender
- [ ] **Plantilla de carga del piloto:** qué se le pide a cada vendedor (producto, estado, stock, moneda, precio visible u oculto, foto)
- [ ] **Plan para cuando algo falla el 31/10:** quién decide, cuándo se revierte y cómo. Hoy está repartido entre [DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md) y [RESPALDOS.md](../tools/deploy/RESPALDOS.md)
- [ ] **Guion de la prueba en *staging***: el bloque 7 de este archivo, con datos de ejemplo

## 5. Decisiones y confirmaciones

- [ ] **Bloquea · Dazz:** elegir el VPS (recomendado: uno nuevo de 2 vCPU y 4 GB, no el de Yallegó)
- [ ] **Bloquea · Dazz:** comprar el dominio. *Staging* puede vivir en un subdominio provisional
- [ ] **Bloquea · Fabrizio:** el número de WhatsApp de PaseLibre. Se fija al construir la imagen de la web: mientras falte, el botón no aparece
- [ ] **Fabrizio:** el correo, el horario de atención y las redes de PaseLibre (Facebook, Instagram, TikTok) para la columna Contacto del pie. Se escriben en `apps/web/src/shared/contacto.ts`; lo que falte no se muestra
- [ ] **Fabrizio:** confirmar el inicio de sesión con correo o usuario y contraseña
- [ ] **Fabrizio:** confirmar el plazo de 7 días para avisar de publicaciones sin actualizar
- [ ] **Equipo:** elegir el eslogan («Lo que a tu tienda le falta, otra en Wilson ya lo tiene.» frente a «Busca tu wbada»)
- [ ] **Dazz:** abrir la cuenta de B2 para las copias de seguridad (`RCLONE_DESTINO`)
- [ ] **Fase 2, sin fecha:** porcentajes, planes y precios

## 6. Servidor y dependencias de infraestructura

Se hace cuando exista el VPS. La guía está en [tools/deploy/DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md).

**Dazz**

- [ ] Instalar Docker, nginx, certbot, git y rclone; cortafuegos con solo 22, 80 y 443
- [ ] Apuntar el dominio y el subdominio de *staging* a la IP del servidor
- [ ] Clonar el repositorio en `/opt/paselibre/app` y crear `/opt/paselibre/config`
- [ ] Crear los archivos de entorno de *staging* y producción, con permisos 600 y contraseñas de `openssl rand -hex 24`
- [ ] Crear la carpeta de fotos con dueño uid 1000 (`install -d -o 1000 -g 1000 -m 755 …`)
- [ ] Configurar nginx y pedir el certificado de Let's Encrypt; probar `certbot renew --dry-run`
- [ ] Primer despliegue de *staging* con `desplegar.sh`
- [ ] Primera cuenta del equipo con `cuenta-equipo.sh`
- [ ] Datos de demostración en *staging* con `semilla-demo.sh`, con `CLAVE_DEMO` propia (el repositorio es público)
- [ ] Configurar `respaldo.env`, instalar el cron y probar la copia a B2
- [ ] Ensayar la restauración completa en *staging* (`ensayar-restauracion.sh`)
- [ ] Monitor externo (UptimeRobot, Better Stack…) pidiendo `/v1/salud/lista` cada minuto, con aviso por correo

## 7. Prueba de punta a punta en *staging*

**Dazz y el equipo**, con *staging* arriba. Es lo que el documento 05 §13 pide antes de salir. Sirve igual para repetirlo en producción.

- [ ] `humo.sh` pasa contra el dominio de *staging*
- [ ] Un visitante busca «rtx 3370» y ve la 3070 con «Mostramos resultados para…», sin precio, tienda, stand ni WhatsApp
- [ ] Ingresar con una cuenta del piloto y cambiar la clave en el primer ingreso
- [ ] Publicar uno igual y publicar un producto nuevo con fotos; las fotos salen por `/media` con caché
- [ ] Una publicación nueva toma menos de 2 minutos (RNF-03)
- [ ] Contactar por mensaje y por WhatsApp
- [ ] Dos tiendas conversan en tiempo real por el WebSocket de nginx; recargar la página recupera lo pendiente
- [ ] Marcar «Vendido» desde el chat y comprobar que baja el stock
- [ ] Un usuario bloqueado no puede escribir
- [ ] La campanita avisa y «No molestar» la silencia
- [ ] El límite por IP funciona con la IP real del cliente (nginx pasa `X-Forwarded-For`)
- [ ] La carpeta de fotos acepta escrituras de la API (uid 1000)
- [ ] Traspasar publicaciones entre dos cuentas de una misma tienda
- [ ] Todo lo anterior se repite en un celular Android y en un iPhone
- [ ] Revertir a la versión anterior con `desplegar.sh <env> <etiqueta>` funciona

## 8. Piloto y datos

**Fabrizio y el equipo**

- [ ] **Bloquea:** definir los 5 a 10 vendedores del piloto
- [ ] Crear sus cuentas desde `/equipo/cuentas` y entregarles el acceso
- [ ] Conseguir fotos reales de sus productos
- [ ] Cargar los productos y el stock del piloto (viernes 30/10)
- [ ] Revisar los duplicados que aparezcan y unirlos (requiere lo de §2)
- [ ] Preparar el mensaje de lanzamiento para las tiendas de Galería Wilson

## 9. Día de salida · sábado 31/10

**Dazz**

- [ ] Todos los bloques anteriores marcados, o con la decisión de salir sin ellos anotada
- [ ] `git pull` en el servidor y el repositorio limpio, en el commit que se publica
- [ ] `desplegar.sh produccion.env` con `RESPALDO_ENV` puesto
- [ ] `humo.sh` pasa contra el dominio de producción
- [ ] Primera cuenta del equipo creada en producción; **sin** semilla de demostración
- [ ] Monitor externo apuntando a producción
- [ ] Una cuenta real inicia sesión desde un celular
- [ ] Aviso a Fabrizio de que ya está en línea

## 10. Después de salir

- [ ] Revisar las búsquedas sin resultados cada semana (RT-03)
- [ ] Revisar las denuncias y los duplicados
- [ ] Mirar el respaldo de la primera noche y el ensayo del primer domingo
- [ ] Decidir el orden de la fase 2 con lo que pidan las tiendas
