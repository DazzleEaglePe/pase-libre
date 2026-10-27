# 02 · Requerimientos funcionales

**Versión:** 0.8 (borrador) · **Fecha:** 26/10/2026

## Cómo leer este documento

- **Prioridad (MoSCoW):** **Must** = imprescindible para la primera versión · **Should** = importante, entra si hay tiempo · **Could** = deseable.
- **Origen:**
  - **Chat** — lo dijo alguien en el grupo.
  - **Boceto** — sale del dibujo de Fabrizio (22/10).
  - **Prototipo** — sale de la captura de TechGallery.
  - **Propuesto** — lo agrega este borrador para completar el flujo. Hay que validarlo.
  - **Lienzo** — sale del [lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A) del 25/10 (A: primera versión; B: eBay y Mercado Libre; C: cuenta, mensajes y configuración).
- Los requerimientos marcados **(por validar)** dependen de una pregunta abierta del [documento de contexto](01-contexto-y-analisis.md#9-preguntas).
- **Vendedor** = tienda, asesor de una tienda o vendedor independiente (D-10). Los tres publican de la misma forma.

---

## 1. Cuentas y vendedores

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-01 | *(Fase 2)* Un vendedor (tienda o independiente) puede **registrarse por su cuenta** indicando tipo, nombre, número de WhatsApp y, si tiene, galería y stand. Para los independientes, galería y stand son opcionales | Should | Chat 24/10, Dazz 25/10 |
| RF-02 | Un vendedor puede **iniciar sesión con correo o usuario y contraseña** para gestionar sus publicaciones | Must | Chat 24/10 (Grimm), Dazz 25/10 |
| RF-03 | Cada vendedor tiene un **perfil** que muestra nombre, tipo (tienda o independiente), galería y stand si los tiene, y sus publicaciones activas | Should | Propuesto |
| RF-04 | *(Fase 2, junto con el registro propio)* Todo registro nuevo queda **pendiente de aprobación**: el administrador lo aprueba o rechaza antes de que el vendedor pueda publicar. Mientras tanto, el usuario ve la pantalla **«Tu cuenta está en proceso de aprobación»**. Sirve para filtrar bots y publicaciones de chiste | Should | Chat 24/10 (Grimm y Fabrizio) |
| RF-35 | El administrador de la plataforma puede **crear la cuenta de un vendedor** (dueño de tienda, asesor o independiente) y asignarla a una tienda, con nombre de la tienda, galería, stand, persona, usuario, correo opcional, WhatsApp y una contraseña inicial generada. En el MVP el equipo crea las cuentas y las entrega | Must | Chat 24/10, Dazz y lienzo 25/10 |
| RF-43 | La pantalla de inicio muestra los botones **«Iniciar sesión»** y **«Crear cuenta»**. Mientras no haya registro propio, «Crear cuenta» muestra un aviso: «Estamos en mantenimiento; pronto podrás crear tu cuenta» | Must | Dazz 25/10 |
| RF-49 | El panel del equipo lista las cuentas del piloto con su estado («Activa» o «Sin primer ingreso») y permite **reenviar el acceso** | Should | Lienzo 25/10 |
| RF-50 | «¿Olvidaste tu contraseña?» indica que se pida al equipo de PaseLibre. En el perfil hay «Cambiar contraseña» | Must | Lienzo 25/10 |
| RF-36 | *(Fase 2)* El dueño o administrador de una tienda puede **crear y gestionar las cuentas de sus asesores**. Los asesores solo inician sesión y **no pueden crear usuarios**. El número de asesores tiene un **límite según el plan** | Could | Chat 24/10 (Dazz, Fabrizio) |
| RF-41 | Cada tienda puede elegir **perfil público o privado**. En privado aparece como «Vendedor privado» con su galería: se ocultan nombre y stand, y sus publicaciones siguen visibles. El perfil muestra «Así te ven otros vendedores» y se puede volver a público cuando se quiera | Should | Chat 24/10, lienzo 25/10 |
| RF-48 | En su perfil, la tienda fija los **valores por defecto al publicar**: precio oculto o visible y moneda (US$ o S/). Cada publicación puede cambiarlos | Should | Lienzo 25/10 |

## 2. Publicaciones

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-05 | Un vendedor aprobado puede **publicar un artículo** con título, categoría, etiquetas, descripción, fotos y precio | Must | Chat |
| RF-06 | El **producto siempre se ve**. El vendedor configura el **precio** de cada publicación como **visible** u **oculto** («Al interno»), y por defecto queda **oculto**. Quien quiera el precio lo consulta por chat o WhatsApp | Must | Chat 22/10, Dazz 25/10 |
| RF-07 | Las publicaciones se **clasifican por etiquetas** (por ejemplo, marca, modelo, serie, capacidad) además de la categoría | Must | Chat |
| RF-08 | Un vendedor puede **editar, pausar, reactivar y eliminar** sus publicaciones | Must | Propuesto |
| RF-09 | Cada publicación tiene una **cantidad en stock** y muestra la **fecha de su última actualización** | Must | Chat 24/10, Dazz 25/10 |
| RF-10 | «Mis publicaciones» **avisa** de las publicaciones que llevan más de 7 días sin actualizarse y las marca con «Revísala» | Could | Propuesto, lienzo 25/10 |
| RF-11 | Las **categorías iniciales** son: Gráficas, Procesadores, Placas, RAM, Cases, Monitores y Periféricos. Se pueden ampliar | Must | Chat, Boceto |
| RF-37 | *(Fase 2, aprobado en concepto)* El vendedor puede definir un **precio general** y un **precio preferencial** para quienes marcó como **partner o socio** (por ejemplo, 250 USD y 245 USD). Cada comprador ve el precio que le corresponde | Should | Chat 24/10 (Fabrizio, My, Grimm) |
| RF-38 | El vendedor elige la **moneda** de cada precio: **dólares (USD) o soles (S/)** | Must | Chat 24/10, Dazz 25/10 |

## 3. Búsqueda y descubrimiento

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-12 | Hay un **buscador** principal, siempre visible en la parte superior | Must | Boceto, Prototipo |
| RF-13 | La búsqueda **tolera errores de tipeo**: un dígito o letra mal escrito, faltante o intercambiado debe seguir devolviendo resultados relevantes (ej. «3370» debe poder sugerir «3070») | Must | Chat |
| RF-14 | El buscador no devuelve «cero resultados» sin ofrecer alternativas: muestra «Mostramos resultados para *rtx 3070*. Buscaste *rtx 3370*» y **búsquedas relacionadas** | Should | Chat, lienzo 25/10 |
| RF-15 | Un **menú lateral izquierdo** con las categorías grandes permite navegar sin buscar | Must | Chat, Boceto |
| RF-16 | Se puede **filtrar** por categoría, galería, marca, estado y stock, y por rango de precio **solo con sesión**. Los filtros deben ser completos y útiles, no como los del sitio de Memory Kings | Must | Chat, lienzo 25/10 |
| RF-17 | Se puede **buscar por separado en cada galería** y también en todas a la vez | Must | Chat, Prototipo |
| RF-18 | Los resultados se muestran como **tarjetas** con foto, título, estado, stock, galería y fecha de actualización. Con sesión se suman tienda, stand y precio («Precio de pase» o «Al interno · consultar»); el visitante ve «Precio con sesión» | Must | Boceto, Dazz y lienzo 25/10 |
| RF-19 | Hay una **página de detalle** con todas las fotos, descripción, etiquetas y datos de la tienda | Must | Propuesto |
| RF-20 | Los resultados se pueden **ordenar** (más recientes, precio) | Could | Propuesto |
| RF-44 | **Catálogo público:** cualquier persona, sin iniciar sesión, puede **ver, buscar y filtrar** los productos que se ofrecen para pase, con foto, título, categoría, estado, stock y galería. **No ve** precio, nombre de la tienda, stand ni botones de contacto. La interfaz se inspira en eBay | Must | Dazz y lienzo 25/10 |
| RF-45 | El **precio** solo se entrega a usuarios con sesión y solo si el vendedor lo configuró como visible. El visitante nunca lo recibe, ni en pantalla ni en las respuestas del sistema | Must | Dazz 25/10 |

## 4. Contacto

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-21 | En la ficha hay dos botones: **«Enviar mensaje»** (abre el chat de la web, principal) y **«WhatsApp»** (abre el WhatsApp del vendedor con el mensaje «Vi que tienes (artículo) publicado en PaseLibre, ¿a qué precio lo tienes?»). Ambos requieren sesión; el visitante ve «Inicia sesión para contactar» | Must | Chat, Dazz y lienzo 25/10 |
| RF-22 | **El chat dentro de la web entra**, además del botón de WhatsApp (RF-21). Se había descartado el 22/10; el 24/10 Fabrizio lo propuso para consultas sin compromiso y el 25/10 Dazz lo confirmó | Must | Chat 24/10, Dazz 25/10 |
| RF-39 | Un vendedor puede **escribir a otro dentro de la web**, sin salir a WhatsApp, y ver su historial de conversaciones. El chat admite **texto y fotos**, **no archivos**. Requiere sesión | Must | Chat 24/10 (Fabrizio), Dazz 25/10 |
| RF-40 | Cuando llega un mensaje, la **campanita** muestra un contador y, al abrirla, la lista de avisos con un extracto: «Tienes un mensaje importante sin leer de (usuario)…» | Must | Chat 24/10, lienzo 25/10 |
| RF-42 | *(Fase 2)* El mismo aviso llega por **correo** cuando el destinatario no está conectado | Should | Chat 24/10 (Fabrizio, Grimm) |
| RF-47 | En una conversación, bajo los datos del otro usuario (nombre y si está activo), el vendedor tiene **«Marcar como vendido»**. Se abre una ventana para elegir **a quién** se lo vendió entre quienes conversaron sobre ese producto, con el stock antes y después. Al confirmar, el stock **baja en 1** y queda un aviso en el chat. Con 0, el producto pasa a **«Sin stock»** y en «Mis publicaciones» aparece «Reponer stock». Si falta tiempo, el vendedor ajusta la cantidad a mano | Should | Dazz y lienzo 25/10 |
| RF-23 | El sistema **registra cada clic** en «Contactar» (publicación, tienda, fecha), sin guardar el contenido de la conversación | Should | Propuesto |

## 5. Requerimientos de compra («Lo tengo!!») (fase 2)

Salen del boceto de Fabrizio. Dazz confirmó el 25/10 que van en la **segunda fase**.

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-24 | Una tienda puede **publicar un requerimiento**: qué producto busca, categoría, y opcionalmente un presupuesto | Should | Boceto |
| RF-25 | La portada muestra una **banda de requerimientos** recientes | Should | Boceto |
| RF-26 | Otra tienda puede responder **«¡Lo tengo!»** y se abre WhatsApp con el solicitante, con mensaje prellenado | Should | Boceto |
| RF-27 | El solicitante puede **cerrar** el requerimiento cuando lo resuelve; los antiguos expiran solos | Could | Propuesto |

## 6. Administración y moderación

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-28 | Un **panel de administración** permite ver y suspender vendedores y publicaciones. La cola de registros pendientes (aprobar o rechazar) llega con el registro propio, en la fase 2 | Should | Chat 24/10, Propuesto |
| RF-29 | Cualquier visitante puede **reportar** una publicación sospechosa o desactualizada | Could | Propuesto |
| RF-30 | El administrador puede **gestionar categorías y etiquetas** (crear, unir, renombrar) | Should | Propuesto |
| RF-33 | El administrador puede **registrar a un vendedor en persona**, desde el celular, y dejarlo aprobado en el momento (registro asistido) | Should | Chat 24/10 |
| RF-34 | El administrador puede **cargar publicaciones en bloque** desde una planilla, con plantilla descargable, para sembrar el catálogo con el stock que un vendedor ya tiene listo. Los precios entran ocultos | Could | Chat 24/10, lienzo 25/10 |

## 7. Métricas

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-31 | El sistema reporta **tiendas activas, publicaciones, búsquedas y clics en «Contactar»** por galería y por semana | Should | Propuesto |
| RF-32 | El sistema guarda las **búsquedas sin resultados** para saber qué productos faltan | Could | Propuesto |

## 8. Productos y ofertas (lienzo B)

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-51 | Cada publicación es una **oferta** de un vendedor (precio, moneda, stock, estado) sobre un **producto** del catálogo (marca, modelo, categoría, fotos base) | Must | Lienzo B |
| RF-52 | La ficha muestra **«Otras ofertas de este producto»**: vendedor, galería, estado, stock y precio, de menor a mayor. Con sesión se ve el precio cuando es visible; el visitante ve la lista sin precios ni nombres de tienda | Must | Lienzo B, Dazz 25/10 |
| RF-53 | Al publicar, el sistema **sugiere el producto existente** («Ya está en PaseLibre») y ofrece **«Publicar uno igual»**: copia fotos y datos, y el vendedor solo pone stock, estado y precio. También se ofrece desde cualquier ficha | Must | Lienzo B, Dazz 25/10 |
| RF-54 | El equipo puede **unir productos duplicados** del catálogo | Should | Propuesto |

## 9. Cuenta, mensajes y configuración (lienzo C)

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-55 | **Mensajes** reemplaza al chat de la primera versión: lista con filtros (todas, no leídos, archivados), buscador por tienda o producto, y el producto fijo arriba de cada conversación | Must | Lienzo C, Dazz 25/10 |
| RF-56 | **Respuestas rápidas** sobre la caja de texto («¿Sigue disponible?», «Te lo separo»…), editables en Configuración | Must | Lienzo C, Dazz 25/10 |
| RF-57 | En cada conversación se puede **marcar como no leída, silenciar, archivar, bloquear** (con confirmación) **y denunciar**. Un usuario bloqueado no puede escribir. El «Visto» se puede desactivar | Must | Lienzo C |
| RF-58 | **Configuración · Datos de la cuenta:** nombre de la tienda, persona a cargo, correo, WhatsApp, logo, horario de atención y descripción. El usuario, la galería y el stand solo los cambia el equipo | Must | Lienzo C, Dazz 25/10 |
| RF-59 | **Configuración · Avisos:** por tipo de aviso (mensajes, pedidos, preguntas, favoritos, recordatorios) se elige si llega a la campanita, y **«No molestar»** por horario. La columna de correo aparece cuando llegue RF-42 | Must | Lienzo C, Dazz 25/10 |
| RF-60 | **Configuración · Seguridad:** cambio de contraseña desde la cuenta, al que se llega por un menú de cuenta en el avatar | Must | Lienzo C, Dazz 25/10 |
| RF-71 | **Bandeja por persona:** cada conversación es entre quien escribe y el **responsable** de la oferta, que es quien la publicó. El dueño no ve las conversaciones de sus asesores ni al revés. Si un usuario deja la tienda, el equipo pasa sus ofertas y conversaciones a otro usuario de la misma tienda | Must | Dazz 26/10 |

## 10. Fase 2 de los lienzos B y C

| ID | Requerimiento | Prioridad | Origen |
| --- | --- | --- | --- |
| RF-61 | **Pedir pase:** cantidad, para cuándo y mensaje. El vendedor lo **acepta y separa** o responde «No lo tengo» desde su **bandeja**, y luego lo marca **concretado**, lo que descuenta el stock | Could | Lienzo B |
| RF-62 | **Preguntas públicas** en la ficha, visibles para los vendedores con sesión, que el vendedor responde desde su bandeja | Could | Lienzo B |
| RF-63 | **Reputación:** pases concretados, tiempo de respuesta, porcentaje de pedidos aceptados y etiqueta «Responde rápido» | Could | Lienzo B y C |
| RF-64 | **Favoritos y seguir tiendas**, con aviso cuando baja un precio o una tienda publica algo nuevo | Could | Lienzo B y C |
| RF-65 | **Tienda pública:** vitrina con productos, reputación y «Sobre la tienda», buscador interno, «Seguir» y «Enviar mensaje» | Could | Lienzo C |
| RF-66 | **Página de notificaciones** con filtros por tipo y «Marcar todo como leído» | Could | Lienzo C |
| RF-67 | **Sesiones abiertas:** ver dónde está abierta la cuenta y cerrar las demás | Could | Lienzo C |
| RF-68 | **Respuesta automática** fuera del horario de atención | Could | Lienzo C |
| RF-69 | **Publicar paso a paso** con medidor de calidad de la publicación | Could | Lienzo B |
| RF-70 | **Inicio con sesión:** pendientes del día, «Seguir buscando» y «Visto recientemente» | Could | Lienzo B |

---

## Fuera de alcance

- App móvil: llega **después de la web**, con la misma cuenta (D-21).
- Pagos, carrito, envíos o cualquier intermediación de la venta.
- Reseñas o calificaciones (se pueden evaluar más adelante).
- Venta de productos fuera de componentes de PC y periféricos.

## Resumen del MVP mínimo (propuesto)

Con la meta de salir antes de Halloween, el MVP sería: **RF-02, 05, 06, 07, 08, 09, 11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 35, 38, 39, 40, 43, 44, 45, 50, 51, 52, 53, 55, 56, 57, 58, 59, 60 y 71**.

Es decir: un **catálogo público sin precio**, el botón de **iniciar sesión** (y un «Crear cuenta» en mantenimiento), cuentas que crea el equipo para dueños y asesores, publicar con stock y precio configurable, buscar con tolerancia a errores, filtrar por categoría y galería, y contactar por WhatsApp o por el **chat de la web** (texto y fotos, con campanita). Además: productos con varias ofertas y «Publicar uno igual» (RF-51 a RF-53), mensajes con filtros, respuestas rápidas y acciones de conversación (RF-55 a RF-57), y configuración de datos, avisos y contraseña (RF-58 a RF-60).

**Entra si hay tiempo:** botón «Vendido» (RF-47), sugerencias de búsqueda (RF-14), valores por defecto al publicar (RF-48) y lista del piloto (RF-49). **Por decidir:** perfil privado (RF-41).

**Pasa a la segunda iteración:** registro propio y aprobación (RF-01 y RF-04), aviso por correo (RF-42), precio por rol (RF-37), cuentas de asesores gestionadas por el dueño (RF-36), requerimientos, carga en bloque, métricas, la app y lo que queda de los lienzos B y C (RF-61 a RF-70).

**Ojo:** con el chat dentro de la web, el alcance es ajustado para seis días. El [documento 04](04-decisiones-para-la-reunion.md) trae los recortes propuestos y un plan B.
