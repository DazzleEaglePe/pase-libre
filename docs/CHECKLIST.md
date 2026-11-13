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
- [x] Las denuncias ya tienen dónde verse: Panel del equipo › Reportes, con la decisión y el aviso a quien reportó (sección 20 del lienzo, 11/11)
- [ ] **Antes de salir:** unir productos duplicados (RF-54). La base tiene `fusionado_en_id` y la web redirige con 301, pero el equipo no puede unirlos. Mínimo: un script
- [ ] Reporte de uso (RF-31, RF-32): las tablas `Busqueda` y `Contacto` existen; falta la consulta lista, una por semana y galería
- [x] `limites.e2e-spec` fallaba una de cada tres veces («socket hang up»): era supertest abriendo un servidor por pedido; ahora la app de pruebas escucha una vez en 127.0.0.1 (09/11, [15](15-calidad.md))
- [x] Ajuste de forma de Hielo: ya no aplica, el lienzo «Versión final» usa píldoras como la web (D-54)
- [ ] Modo claro y oscuro (Claro / Oscuro / Sistema) en toda la web: sprint del 09 al 13/11 con sus checklists en [13 · Modo oscuro](13-modo-oscuro.md)
- [x] Construir lo que trae el lienzo «Versión final» (163 tableros en 20 secciones): las 20 secciones en `main`, en producción desde el 10/11/2026 (`c5efc279`). Estado, simplificaciones y pendientes en [14 · Lienzo final](14-lienzo-final.md) §5
- [x] Subir los commits del lienzo final y desplegarlos: en producción desde el 10/11/2026 (`c5efc279`), con respaldo previo y las 14 migraciones (`20261110120000` a `20261111130000`). Para volver: `desplegar.sh produccion.env b1522d99` (las migraciones no se deshacen; para eso está el respaldo de ese momento)
- [x] Correcciones del lienzo del 11/11 (`GUIA_Construir`, `COR1` a `COR26`): en producción desde el 11/11/2026 (`d9ea775b`; `e724b81a` con dos arreglos de la pasada de pruebas; y `8fb0eb41`, que deja la raíz mostrando la portada pública en vez de mandar a Iniciar sesión), con respaldo previo y 5 migraciones; volver con `desplegar.sh produccion.env 95d813e0` (las migraciones no se deshacen) ([14](14-lienzo-final.md) §6)
- [ ] «Pedir mi cuenta por WhatsApp» en Iniciar sesión: falta el número del equipo (`NEXT_PUBLIC_WHATSAPP_EQUIPO`, se pone al construir la imagen de la web)
- [ ] Cargar `metros` de cada galería para que «Wilson en vivo» diga «a N min caminando» (lo hace el equipo; sin eso no se muestra)
- [ ] Registro propio (sección 3 del lienzo): hecho y apagado (`REGISTRO_PROPIO`). Para encenderlo en producción faltan un proveedor de SMS y uno de consulta a SUNAT, y subir las fotos del stand ([14](14-lienzo-final.md) §5)
- [ ] Lo que quedó de la auditoría de calidad (seguridad, rendimiento, pruebas y diseño): lista ordenada en [15 · Calidad](15-calidad.md) §6
- [ ] **Fase 2:** perfil privado, «Quién puede escribirte», respuesta automática, idioma y aviso por correo en Configuración
- [ ] **Fase 2:** registro propio con aprobación, precio por rol, requerimientos, pedir pase, preguntas públicas, reputación, favoritos, tienda pública, notificaciones y la app

## 3. Diseño

**Grimm y My**

- [x] El lienzo «Versión final» ya está en la línea nueva (verde esmeralda y Figtree) y la web la sigue desde el 08/11 (D-54)
- [ ] Revisar la web en celular, en las pantallas de la primera salida, y avisar de lo que se vea mal
- [x] En vivo (busco y ofertas flash) diseñado en el lienzo; elegida la propuesta E el 29/10 (D-53)
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
- [x] **En vivo** (D-53) construido detrás de `EN_VIVO`, apagado en producción (29/10)
- [ ] Decidir cuándo se enciende En vivo y cerrar las tres preguntas del [documento 11 §7](11-plan-de-desarrollo.md#7-en-vivo)

## 11. Correcciones 11/11 y feed (lienzo versión `1794455592-a02d`)

Páginas «★ CORRECCIONES 11/11 · versión elegida» (tableros `N00`–`N14`) y «★ FEED» (`N15`, `N16`) del [lienzo](https://claude.ai/artifact/EPB8HopVtygjLksky5HjC7). Se construyó por áreas en ramas `nov11/*` y se unió en `main` el 12/11 (resumen en [docs/14 §7](14-lienzo-final.md#7-correcciones-1111-y-feed-versión-1794455592-a02d)). **En producción desde el 12/11/2026** (`add9c5bd`), con respaldo previo (`paselibre-produccion-20261112T135627Z.dump`) y 5 migraciones (`20261112100000` a `20261112150000`); volver con `desplegar.sh produccion.env 8fb0eb41` (las migraciones no se deshacen; para eso está el respaldo).

**A · Chat y respuestas rápidas** (rama `nov11/chat`)

- [x] 1 · Puntito verde en la lista de chats para las tiendas conectadas; «Activo ahora» → «Activo hace N min» en vivo (30 s de gracia al recargar)
- [x] 1 · Checks como WhatsApp: enviado, le llegó, lo leyó (verde); con el «Visto» apagado quedan grises
- [x] 1 · Editar y eliminar dentro de 15 min («editado», «Eliminaste este mensaje»; para todos o para mí); lo de una venta cerrada no se cambia
- [x] 1 · Pedir WhatsApp en los dos sentidos: botón arriba del chat, tarjeta Aceptar / Ahora no, número guardado en el chat con «Abrir»; «Compartir mi WhatsApp» desde ⋯
- [x] 2 · Botón «Marcar vendido»: blanco → verde suave al pasar → confirmación «¿Se la vendiste a …?» → verde sólido «Vendido» con «Deshacer»; solo lo ve quien vende
- [x] 3 · Tarjeta de calificar con X y «Ahora no»; cerrada queda chiquita («Calificar a …»)
- [x] 11 · Respuestas rápidas por papel: «Cuando te escriben» (vendes) y «Cuando tú preguntas» (compras); en cada chat solo las del papel; «Nombre de la tienda» se reemplaza; al tocar se escribe en la caja, no se envía sola; sugerencias para agregar

**B · Perfil, reputación y configuración** (rama `nov11/perfil`)

- [x] 3 · Reputación: «🌱 Nueva en PaseLibre» con barra gris hasta 5 opiniones; después nivel (Baja → Excelente) que junta estrellas, pases cerrados y rapidez, lo reciente pesa más
- [x] 3 · Calificación baja con comentario privado (solo la tienda y el Equipo); «Responder» y «Pedir revisión al Equipo»
- [x] 3 · Historial: «¡Lo estás haciendo genial! Te faltan N ventas para tu insignia de plata»
- [x] 4 · Perfil de otra tienda: cabecera A (negra, estilo Pinterest), botones Escribir / Siguiendo, pestañas Productos · Opiniones · Detalles, tarjeta «Sobre la tienda» con reputación que se ilumina hasta su nivel
- [x] 4 · Tu propio perfil igual que lo ven los demás + «Editar perfil», «Cambiar portada» y la franja «Tu mes» (solo tú)
- [x] 4 · Tarjetas de producto con borde de 2 px en el perfil y en el feed
- [x] 9 · Configuración A + B: íconos nuevos (Preferencias «ajustes», Tiendas bloqueadas «restringido») y rayitas entre opciones
- [x] 9 · Datos de la tienda: galería, piso y stand (cambio «Pendiente de aprobación» del Equipo), horario por días con «+ Otro horario», «Cómo llegar», «Sobre la tienda», «Perfil al N %»
- [x] 9 · «Mi acceso»: usuario (lo cambia el Equipo), correo y mi WhatsApp de la persona que entra; se va «Persona a cargo»

**C · Asesores, seguridad y panel del Equipo** (rama `nov11/equipo`)

- [x] 10 · Máximo 2 dispositivos para la cuenta principal: al entrar desde un tercero, elegir cuál cerrar (después de la contraseña); aviso al cerrar una sesión; el Equipo puede subir el límite
- [x] 10 · Seguridad en tarjetas: sesiones abiertas «N de 2», cerrar todas las demás, «Verificación en dos pasos · Próximamente»
- [x] 12 · Asesores (hasta 3) con permisos por asesor (casillas; chatear siempre; asesores y seguridad solo el dueño); contraseña visible solo al crearla; cada mensaje dice quién lo escribió
- [x] 14 · Ficha completa de la tienda en el panel (pestañas Datos, Imagen, Publicaciones, Conversaciones, Actividad, Reportes y advertencias, Acceso, Historial de cambios); la columna WhatsApp lee el de la tienda; toda la fila abre la ficha
- [x] 14 · Acceso: contraseña temporal o definitiva, cerrar sesiones, límite de dispositivos; aviso a la tienda de cada cambio
- [x] 14 · Conversaciones: clic y se abre en solo lectura (con editados y borrados), sin preguntar motivo; queda anotado quién y cuándo
- [x] 14 · Modo soporte «Ayudar como la tienda»: 1 hora, todo registrado, aviso a la tienda; lo pide la tienda o lo activa el Equipo
- [x] 14 · Chat del Equipo con respuesta automática (primera vez o tras 12 h) editable; reportes con «Dar advertencia» / «Cerrar sin cambios»; «1 de 3» cuenta advertencias, no reportes

**D · Feed, bienvenida, publicar y pie** (rama `nov11/feed`)

- [x] Feed · 0 publicaciones: bienvenida, precios protegidos, lo que más se pide, tiendas que ya están, piloto «N de 20», primeros pasos (nunca cuadrícula vacía)
- [x] Feed · 1 a 11: lo nuevo en lista con «Van N de 12»; desde 12 inicio normal, cambia solo y no vuelve atrás
- [x] Feed · Recién publicado hasta 4 filas de 6 (24), mezclado por tienda; flechita → siguientes 24 sin fin; pedidos en vivo en el rectángulo negro; «¡Lo tengo!» abre el chat; sin leyenda de precios
- [x] 5 · Bienvenida más cálida («Te protegemos de estafas y malos tratos», «todos los días»)
- [x] 6 · Publicar: «Precio fijo ▾» dentro del campo, burbujita Pase / Negociable / Socio (verde claro con dorado) / Por chat (plomo); detalles nuevos (Con caja, Probada, Con comprobante, Accesorios completos, Entrega inmediata); «Al interno · por chat» pliega el precio
- [x] 7 · Pie A «Tu venta es tuya…»; banner «¿Conoces una tienda…?» con X que se guarda en la cuenta
- [x] 7 · «Recién llegados» cuenta lo nuevo desde tu última visita (sin lo tuyo, máximo 24 h, dice «nuevo»)
- [x] 7 · Avisos: al tocarlos bajan los contadores en todos lados; abrir un chat marca su aviso como leído

**E · Wilson en vivo y buscar tiendas** (rama `nov11/wilson`)

- [x] 8 · Todas las galerías, la tuya primero; solo verde «Pocos / Varios / Muchos» por tercios, todo verde suave con menos de 20 productos; solo cuentan productos con stock
- [x] 13 · Pestaña «Tiendas» en Wilson en vivo (directorio con galería, piso, «Vende», orden por reputación)
- [x] 13 · El buscador de arriba muestra tiendas («TIENDAS») y «Ver todas las tiendas ›»; las reservadas nunca salen (filtro en el servidor); nada de esto para visitantes

**Pendiente de Fabrizio / diseño** (el lienzo lo deja abierto; se construye con lo marcado y se cambia si dicen otra cosa)

- [ ] Listado de galerías en orden (sección 8) · mientras tanto, las que ya están en la base
- [ ] ¿El cambio de galería pasa por aprobación del Equipo? · se construye con aprobación, como dice el tablero
- [ ] ¿Los asesores tienen límite de dispositivos? · se construye solo para la cuenta principal
- [ ] ¿Una tienda reservada se encuentra en «Agregar socio» con su nombre exacto? · queda como hoy

## 12. Seguridad y escala ([docs/16](16-seguridad-y-escala.md))

- [x] Fase 0 · nginx: límites, tiempos de espera y subidas por ruta (11/11, en producción)
- [x] Búsqueda: caché de visitantes, una sola consulta y tabla resumen; volver a medir con `tools/carga` (con fechas reales: 1 010–1 799 pedidos/s y p95 de búsqueda 40–88 ms; ver `tools/carga/README.md`)
- [x] Memoria corta para «Recién publicado» del visitante y 503 con `Retry-After` (en producción desde el 12/11/2026, `16f8c2c7`; volver con `desplegar.sh produccion.env add9c5bd`): con el catálogo grande de docs/16 tal cual, de 330–413 a 3 604–4 069 pedidos/s; base saturada o caída responde 503 con `Retry-After` 5 o 15 s y `pool_timeout` baja de 20 a 5 s (resultados en `tools/carga/README.md`)
- [x] Fase 0 · `unattended-upgrades` (parches de seguridad de Debian, sin reinicio solo) y `fail2ban` para SSH (12/11, en el servidor; CrowdSec descartado por poca RAM libre)
- [x] Fase 1 · nginx listo para Cloudflare: IP real solo desde sus rangos y renovación del certificado por HTTPS (12/11, en producción)
- [x] Fase 1 · Cloudflare: cuenta creada, dominio agregado (plan Free, DNS A `@`/`www` → 167.148.33.199 en proxy), DNSSEC apagado en Spaceship y *nameservers* cambiados a `dahlia.ns.cloudflare.com`/`mack.ns.cloudflare.com` (12/11). **En propagación** (Cloudflare: 1-2 h, hasta 24-48 h); el servidor sigue sano (probado por IP directa). Falta: cuando Cloudflare diga «Active», configurar caché, WAF y reglas de límite
- [ ] VPS propio o más RAM para PaseLibre (decisión y compra de Dazz/Fabrizio)
- [ ] Dos réplicas de la API con Redis (después del VPS: en el servidor actual no hay RAM)

## 13. Catálogo: fotos, ZIP que actualiza y «Eliminar todos» ([docs/17](17-catalogo-fotos-y-zip.md))

**En producción desde el 12/11/2026, `0bb30bd6`** (dos migraciones nuevas: 35 en total; respaldo previo `paselibre-produccion-20261112T164908Z.dump`). Volver con `desplegar.sh produccion.env 16f8c2c7` (las migraciones no se deshacen).

- [x] 1 · Fondo gris clarito `#F1F4F2` con la foto en `multiply` en todas las miniaturas; tarjetas cuadradas
- [x] 2 · «Editar» en Catálogo cambia también las fotos y la principal, con «¿Estás seguro?» si hay publicaciones
- [x] 3 · Subir el ZIP: «Dejarlos como están», «Reemplazar solo las fotos» o «Reemplazar fotos y datos», con «Lo que cambia» y casillas; «por confirmar» no es un código; fotos por código o por el nombre del producto; aviso de parecidos y filas repetidas
- [x] 4 · «Eliminar todos» por tandas: nunca borra un producto con publicaciones, pedidos en vivo o uniones
- [x] 5 · La tienda elige la portada de su publicación (al publicar y al editar); el visitante ve la elegida, que ya veía en la ficha
- [x] 6 · nginx: ya estaba (41m en la ruta de importar desde la fase 0)
- [x] Copia de las fotos antes de desplegar: `/var/backups/paselibre/fotos/media-antes-0bb30bd6-20261112T164057Z.tar.gz` (215 fotos; el respaldo de la base no guarda fotos y reemplazar borra las viejas)
- [ ] Subir el catálogo nuevo (lo arma la sesión de diseño; ~800 productos): WebP transparente, varios ZIP por categoría de menos de 35 MB (límite 40 MB), con «Reemplazar fotos y datos»; probarlos antes en la copia local

## 14. Versión 1.9.0 ([docs/18](18-version-1-9-0.md))

Hecha en `main` el 12/11/2026, con los 9 puntos; las pruebas pasan (API 507, web 106, contratos 68).

- [x] 6 · Logo de la tienda (prioridad): circulito de la cabecera, tarjeta del menú de la cuenta y saludo del inicio, en web y celular; además ficha (fila de la tienda y cada fila de «Las tiendas que lo tienen»), bandeja, chat, seguidas, Tu cuenta, piloto, «Tiendas que ya están» y panel del Equipo. `AvatarTienda` con `tamano`; la API suma `logo` donde faltaba (una tienda reservada no lo muestra a otras).
- [x] 3 · Las 7 galerías (migración `20261112180000_galerias_de_wilson`, no toca las 2 que ya tienen tiendas) y Equipo › Galerías: ordenar, agregar, editar, ocultar y avisos de «Otra galería». Arreglado de paso: con RUC activo y «Otra galería» el registro daba 500; ahora espera a que el Equipo agregue la galería.
- [x] 1 · Rayo de línea verde en «Publicación rápida»; círculos con color fijo.
- [x] 4 · Ficha con más contraste (propuesta 3).
- [x] 7 · Barra de avance al subir el ZIP, «Cancelar», aviso de más de 40 MB y «Volver a intentar».
- [x] 8 · Filas con motivo y conteo por tipo, «Qué pasa» y «Descargar la lista en Excel».
- [x] 5 · Recién publicado en 4 filas con flecha por fila, hasta 18 por fila, «Ver todas»; «hace X» debajo de la tarjeta.
- [x] 2 · Plantilla `.xlsx` armada por la API con una pestaña por categoría; el importador lee todas las pestañas (el .csv y el .xlsx de una hoja siguen funcionando).
- [x] 9 · `packages/contracts/src/version.ts` (`VERSION`, `NOVEDADES`): «PaseLibre 1.9 · Novedades» en el pie de las tiendas y «Versión 1.9.0 · Ver cambios» → `/equipo/versiones`.

En cada tanda nueva: subir `VERSION` y agregar su entrada arriba en `NOVEDADES` (primer número si cambia cómo se usa, segundo si hay algo nuevo, tercero si solo son arreglos).

## 15. Versión 1.9.1: arreglos urgentes del tiempo real ([docs/19](19-version-1-9-1-y-1-10-0.md), parte A)

Hecha en `main` el 13/11/2026; las pruebas pasan (API 513, web 106, contratos 68).

- [x] A1 · El socket y CORS aceptan `WEB_URL`, su par con o sin `www.` y `ORIGENES_EXTRA` (vacío por defecto); un rechazo por origen queda en el registro con el origen y la IP. La regla de Cloudflare «www → raíz» (301) ya estaba.
- [x] A2 · `tryAllTransports`; `useConectado()` y `useRespaldo()` (cada 25 s sin conexión y al volver a la pestaña) en la conversación, la bandeja, el chat con el Equipo (los dos lados), la campanita y En vivo; franja «Reconectando… los mensajes pueden tardar» a los 5 s; si el servidor corta, otro socket con espera de 5 s a 60 s.
- [x] A3 · Evento `equipo:mensaje` a la tienda y a la sala `equipo` (todo usuario EQUIPO), aparte de los avisos: el chat se mueve aunque la tienda tenga «No molestar». El panel del Equipo monta el tiempo real.
- [x] A4 · «Ir al inicio» del primer ingreso hace `router.refresh()`.
- [x] `VERSION = '1.9.1'`.
