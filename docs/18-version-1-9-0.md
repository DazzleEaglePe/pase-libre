# 18 · Versión 1.9.0: correcciones del 12/11

**Fecha:** jueves 12/11/2026 · **Estado:** aprobado por Bruno (diseño), sin código · **Para:** Bruno (desarrollo) · **Versión:** pasa de 1.8.7 a **1.9.0**

Esto **se suma** a los documentos 16 y 17 y no cambia nada de lo que ya está en ellos. Lo revisé contra `main` en `f977acf`.

Las pantallas finales están en el lienzo **«PaseLibre Demo 2»** (privado: Bruno (diseño) te comparte el enlace). Cada punto tiene su tablero con el mismo número. Las fotos de antes y después van en la carpeta `version_1_9_0/`.

| # | Qué | Tam. |
|---|---|---|
| 1 | Ícono de «Publicación rápida»: rayo de línea verde, sin amarillo | S |
| 2 | «Descargar la plantilla» baja un Excel con una pestaña por categoría, y el importador lee todas las pestañas | M |
| 3 | Las 7 galerías en todo el sitio y una pantalla nueva, Equipo › Galerías | M |
| 4 | Ficha del producto con más contraste (propuesta 3) | S |
| 5 | Recién publicado en 4 filas, con flecha por fila y «hace X» debajo de la tarjeta | M |
| 6 | El logo de la tienda en todos los lugares donde hoy salen sus iniciales | M |
| 7 | Barra de avance al subir el ZIP del catálogo | S |
| 8 | Las filas con error dicen qué pasa | S |
| 9 | Número de versión en el pie, «Novedades» para las tiendas y «Versiones» en el panel | M |

**Orden sugerido:** primero 3 (los datos de las galerías se pueden cargar hoy mismo), después 1, 4, 7 y 8 (son cortos), luego 6, 5 y 2, y al final 9, con la lista de novedades de esta tanda.

---

## 1. Ícono de «Publicación rápida»

`apps/web/src/features/publicar/formulario-publicar.tsx`, en las pestañas «Cómo quieres publicar» (cerca de la línea 711).

- **Publicación rápida:** el rayo deja de estar relleno de `#FACC15` y pasa a ser **solo línea**: `fill="none" stroke="#006B47" strokeWidth="2" strokeLinejoin="round"`. El círculo pasa a `bg-pase-medio` (#D5F5E3).
- **A mano:** el lápiz blanco queda igual, y el círculo pasa a `bg-tinta`.
- **Cada círculo tiene su color fijo.** Hoy cambia según la pestaña elegida (`bg-marca` o `bg-secundario`); eso se quita. La pestaña elegida se sigue marcando como ahora, con `border-pase bg-pase-suave`.
- Tamaño de 40 px, igual que hoy.

## 2. Plantilla del catálogo en Excel

Hoy «Descargar la plantilla» (`apps/web/src/features/equipo/catalogo.tsx`, cerca de la línea 923) baja `/plantilla-catalogo.csv`. Con Excel en español, todo cae en la columna A, porque espera punto y coma.

**El archivo nuevo:** `plantilla_catalogo_paselibre.xlsx`. Puede ser un archivo fijo en `apps/web/public/` o armarse en la API con las categorías de la base; mejor lo segundo, así no se desactualiza.

- **Primera pestaña, «Cómo llenar»:** 5 pasos (el texto está en el tablero 2) y una fila de ejemplo. El ejemplo va solo aquí, no en las pestañas de datos.
- **Después, una pestaña por categoría,** con el nombre exacto de la categoría («Tarjetas de video», «Memoria RAM»…). La fila 1 lleva los títulos.
- **Columnas en todas:** Marca *, Modelo *, Serie / versión, Código de parte, Sinónimos, Foto *.
- **Columnas propias de cada categoría,** que se guardan como características:

| Pestaña | Columnas propias |
|---|---|
| Procesadores | Núcleos / hilos, Socket, Frecuencia máx., Caché |
| Tarjetas de video | VRAM (GB) *, Tipo de memoria, Bus, Boost |
| Placas madre | Socket *, Chipset, Memoria (DDR4 / DDR5), Formato, Red |
| Memoria RAM | Tipo *, Capacidad *, Velocidad, Latencia, Formato |
| Almacenamiento | Tipo *, Capacidad *, Interfaz, Lectura |
| Fuentes de poder | Potencia *, Certificación, Cables, Norma |
| Cases | Formato, Ventiladores incluidos, Fuente |
| Refrigeración | Tipo *, Radiador, Iluminación |
| Monitores | Tamaño *, Resolución, Frecuencia, Panel |
| Teclados / Mouse | Tipo, Conexión |
| Audífonos y parlantes | Tipo |
| Estabilizadores y UPS | Potencia, Capacidad, Tomas |
| Las demás | Solo las columnas de todas |

- **Formato:**
  - Títulos obligatorios en verde oscuro (#006B47) con letra blanca; los opcionales en #5B8F77.
  - Listas desplegables (validación de datos) en Marca y en los campos con pocas opciones: Tipo de memoria, Memoria (DDR4 / DDR5), Panel, Conexión, Certificación.
  - Fila 1 inmovilizada.

**El importador** (`apps/api/src/modules/soporte/catalogo-equipo.service.ts`; hoy `leerXlsx` lee una sola hoja):

- Si el .xlsx tiene varias pestañas, lee todas menos «Cómo llenar». La **categoría sale del nombre de la pestaña**; se busca igual que hoy, con `categoriaValida`.
- Las filas se nombran «Tarjetas de video · fila 5» para que el error diga dónde está.
- Un .xlsx de una sola hoja con la columna «categoría» y el .csv siguen funcionando como hoy, para no romper los archivos que ya existen.
- Las pestañas vacías se saltan sin aviso.

## 3. Las 7 galerías en todo el sitio

La causa es solo de datos: `GALERIAS` en `apps/api/prisma/semilla.ts` crea únicamente Maxiplaza y Cyberplaza. Crear cuenta, Configuración › Datos de la tienda (`/cuenta/galerias`) y Wilson en vivo ya leen de la tabla `Galeria`.

**Datos.** En este orden: CyberPlaza, CompuPlaza, Galerías Garcilaso, MaxiPlaza, Galería Centro de Lima, Compu Wilson, Galería Global.com.

- Agregarlas a la semilla con su `orden` (1 a 7).
- En producción, cargar las 5 que faltan con un `upsert` por `slug`. No tocar las 2 que existen, porque ya tienen tiendas.

**Pantalla nueva, Equipo › Galerías (`/equipo/galerias`).** Va en la barra del panel, junto a «Tiendas».

- La lista se muestra por `orden`, con cuántas tiendas tiene cada galería. Se arrastra para cambiar el orden.
- «+ Agregar galería» pide nombre y, si se quiere, `metros`.
- «Editar» permite cambiar el nombre, los metros y ocultar la galería. Ocultar pone `activa = false`.
- **Una galería con tiendas no se borra, solo se oculta.**
- **Avisos:** cuando alguien se registra con «Otra galería» (ya existe en `formulario-registro.tsx`), su texto sale arriba como «Galería nueva: X», con «Agregar» o «Descartar». Si se agrega, la tienda queda en esa galería.
- Wilson en vivo muestra las 7 aunque alguna no tenga tiendas (con borde punteado) y respeta `orden`.

## 4. Ficha del producto (propuesta 3)

`apps/web/src/features/catalogo/ficha-producto.tsx`. El problema es que el fondo de la página, el cuadro de la foto y las tablas son casi del mismo blanco, y las líneas casi no se ven. Solo cambia el aspecto; nada de lo que hace la ficha.

- **Fondo de la página de la ficha:** #E4EAE7, un tono más oscuro que `fondo`. Solo en esta página.
- **Cuadro de la foto:** borde de 1,5 px `border-borde` (#C6CEC9) y esquinas de 20 px. Por dentro sigue el gris `foto-fondo` del documento 17.
- **Bloque de precio:** pasa a `bg-white` con borde `border-borde`. El precio en la píldora negra, «Con caja», el stock, la tienda y los botones «Chatear ahora» (`bg-pase-medio`) y WhatsApp **quedan como están**.
- **Sinónimos:** las píldoras pasan a `bg-white`, porque `bg-superficie` se pierde sobre el fondo nuevo.
- **«¿Tienes este producto?»:** borde de 1,5 px #B9E6CC.
- **«Las tiendas que lo tienen»:**
  - La tabla va dentro de una tarjeta blanca con borde `border-borde` y esquinas de 20 px.
  - La fila de títulos pasa a `bg-tinta` con letra blanca.
  - Las filas alternan blanco y #F1F6F3.
  - La fila que estás viendo queda en `bg-pase-suave`.
- **«Características»:**
  - Va dentro de una tarjeta blanca con borde.
  - El título va en una franja `bg-tinta` con letra blanca.
  - Las filas alternan #F1F6F3 y blanco, sin las líneas finas de hoy.
- **En el celular,** lo mismo. La tabla de tiendas sigue deslizándose a lo ancho dentro de su tarjeta.

## 5. Recién publicado: 4 filas con flecha por fila

`apps/web/src/features/inicio/recien-publicado.tsx`, `tarjetas.tsx` y `shared/ui/tarjeta-producto.tsx`; en la API, `inicio.service.ts`.

**Cómo funciona**

- Siguen siendo 4 filas de 6 tarjetas, pero **cada fila es una tira propia**.
- **Cómo se reparten:** la publicación 1, 5, 9… va a la fila 1; la 2, 6, 10… a la fila 2, y así. Lo primero que se ve sigue siendo lo más nuevo, igual que hoy.
- **Cada fila guarda hasta 18** (las 6 que se ven y 2 clics más). La API manda hasta **72** en la fase normal, en lugar de 24, junto con el `total`. `/inicio/recien` deja de usarse en el inicio; puede quedar para otra cosa.
- **La flecha:**
  - Es un círculo negro de 48 px **sin número**, a la derecha de la fila y montado sobre el borde de la última tarjeta.
  - Mientras el cursor no está sobre la fila, tiene **opacidad 0,35**; al pasar el cursor por la fila, **1**, con una transición de 0,2 s.
  - Al hacer clic, **solo esa fila** se desliza (`transform: translateX`, 0,45 s) y muestra las 6 siguientes. Si quedan menos de 6, se desliza lo justo para que la última tarjeta quede pegada al borde.
  - Cuando la fila ya se movió, aparece la flecha de volver a la izquierda, con el mismo estilo.
- **El final de cada fila:**
  - Si la fila llegó a 18 y hay más publicaciones que las 72 del inicio, el último lugar es una tarjeta **«Ver todas las publicaciones»** (borde punteado #7FD0A8, fondo `pase-suave`, flecha en un círculo `bg-marca`). Ahí la flecha de la derecha desaparece.
  - Si la fila tiene menos, la flecha desaparece al llegar a su última tarjeta.
- **Debajo de las 4 filas,** el botón «Ver todas las publicaciones (N) ›» lleva a `/buscar?orden=recientes`. Sale solo si `total > 72`.
- **Se quitan** la flecha grande con «+N», los puntitos y el «1–24 de N».
- **En el celular** no hay flechas. Cada fila se desliza con el dedo (`overflow-x: auto` con `scroll-snap`), las tarjetas miden 150 px y se ve un pedazo de la siguiente. Debajo va el mismo botón «Ver todas».

**«Hace 5 min» debajo de la tarjeta.** Hoy la píldora va sobre la esquina de arriba a la izquierda de la foto y tapa el nombre del producto que trae la imagen. Pasa a una línea propia debajo de «Nuevo · Tienda», en `text-[12px] font-bold text-secundario`. En `TarjetaProducto`, la prop `etiqueta` deja de dibujarse encima de la foto.

El tablero «5 · La flecha de cada fila» tiene la animación funcionando (botón ▶ del tablero).

## 6. El logo de la tienda en todos lados

Ya existe `shared/ui/avatar-tienda.tsx` (`AvatarTienda`): muestra el logo o las iniciales. Hoy solo lo usan el directorio y el buscador; en los demás lugares las iniciales están escritas a mano.

- **A `AvatarTienda`** hay que agregarle una prop de tamaño en px (28, 32, 40, 44, 52) y usarlo en lugar de `iniciales(...)` en:
  - la cabecera y el menú de la cuenta: `menu-cuenta.tsx:139`;
  - el saludo del inicio: `en-vivo-ahora.tsx:44`;
  - el piloto: `piloto.tsx:69`;
  - «Tiendas que ya están»: `inicio-tienda.tsx:141`;
  - la ficha, en la fila de la tienda (`Avatar` en `ficha-producto.tsx:78`) y en cada fila de «Las tiendas que lo tienen», donde hoy no hay círculo;
  - los mensajes: `bandeja.tsx:100`, `conversacion.tsx:193` y `:823`;
  - las tiendas seguidas: `pagina-seguidas.tsx:51` y `:354`;
  - Tu cuenta: `tu-cuenta.tsx:138`.
- **En el panel del Equipo** (`tiendas.tsx`, `chats.tsx`, `ficha-tienda.tsx`), también. No es urgente.
- **Si alguna respuesta de la API no trae `logo` de la tienda,** hay que agregarlo.
- El logo va recortado en círculo con `object-cover`. Sin logo, las iniciales salen como hoy.

## 7. Barra de avance al subir el ZIP

`apps/web/src/features/equipo/catalogo.tsx`, en la función `leer` (cerca de la línea 810). Hoy usa `llamarApi` y no se ve nada hasta la respuesta.

- **Subir con `XMLHttpRequest`** para tener `upload.onprogress`. Dentro del mismo recuadro donde se suelta el archivo:
  - el nombre y el peso;
  - la barra (10 px; avance #22C47D sobre #26302C);
  - «Subiendo… 62% · faltan unos 20 s»;
  - los pasos «1 Subir · 2 Revisar filas»;
  - y «Cancelar», que hace `xhr.abort()`.
- **Cuando termina de subir** (`upload.onload`), la barra pasa a ir y venir (no se sabe cuánto falta) y el texto dice «Revisando filas y fotos…» hasta que llega la respuesta.
- **Si se corta,** aparece «Se cortó la subida. No se creó nada.» con «Volver a intentar».
- **Antes de subir,** si el archivo pesa más de 40 MB, se avisa en el momento: «Este ZIP pesa 52 MB, el máximo es 40 MB. Pártelo en dos.» (es el límite de nginx del documento 17).
- Mientras sube, el botón y las 3 opciones quedan bloqueados.

## 8. Las filas con error dicen qué pasa

**API** (`catalogo-equipo.service.ts`): hoy `falta` junta textos como «Foto (no está en fotos/)», tanto si la columna está vacía como si el nombre no se encontró. Cada error pasa a tener un **motivo** y un **texto**:

| Motivo | Cuándo | Texto en «Qué pasa» |
|---|---|---|
| `SIN_FOTO` | La columna Foto está vacía | Falta la foto |
| `FOTO_NO_ESTA` | Hay nombre, pero no está en `fotos/` | No está la foto en la carpeta, con el nombre buscado aparte |
| `FOTO_DANADA` | No se pudo leer | La foto está dañada o no es una imagen |
| `SIN_CATEGORIA` | La categoría está vacía o no existe | Categoría vacía o mal escrita |
| `SIN_MARCA` | Marca vacía | Falta la marca |
| `SIN_MODELO` | Modelo vacío | Falta el modelo |
| `REPETIDA` | El mismo código en dos filas | Código repetido: ya está en la fila N |

- La respuesta suma `motivos: { sin_foto: 28, sin_categoria: 2, repetida: 1, … }`. `SIN_FOTO`, `FOTO_NO_ESTA` y `FOTO_DANADA` se cuentan juntas como «sin foto».

**Pantalla** (la revisión, cerca de la línea 959):

- **El recuadro naranja** pasa de «con errores» a «**no se crean**» y, debajo, una línea por motivo: «28 sin foto · 2 sin categoría · 1 código repetido». En singular, «1 no se crea».
- **El de la izquierda** dice «se crean».
- **Debajo de los recuadros,** un aviso: «Estas 31 filas no se van a crear. Corrígelas en tu Excel y vuelve a subir el ZIP: las que ya se crearon no se duplican.»
- **En la tabla,** la columna «Campo» pasa a llamarse «**Qué pasa**» y usa los textos de arriba. En `FOTO_NO_ESTA` se muestra el nombre buscado en una pastilla (por ejemplo `corsair-4000d.webp`).
- **Al final de la tabla,** si hay muchas filas, «Descargar la lista en Excel» con fila, producto y qué pasa.

## 9. Versión, «Novedades» y «Versiones»

Desde ahora cada tanda sube el número con esta regla:

| Cambio | Ejemplo | Número |
|---|---|---|
| Grande: cambia cómo se usa PaseLibre | Otras galerías, app del celular, pagos, rediseño | 2.0.0 |
| Cosas nuevas que la tienda nota | Esta tanda | 1.9.0 |
| Solo arreglos o retoques | Un color, un texto, algo que no cargaba | 1.9.1 |

La versión de antes de esta tanda es la **1.8.7**.

- **Una sola fuente:** `packages/contracts/src/version.ts` con `VERSION = '1.9.0'` y `NOVEDADES`, una lista de entradas `{ version, fecha, publico: string[], equipo: { nuevo, cambia, arregla, datos } }`. La 1.8.7 entra como «versión base», sin detalle.
- **Para las tiendas, en el pie** (`shared/ui/pie-compacto.tsx`, a la derecha y en chiquito): «PaseLibre 1.9 · Novedades». En el pie salen solo los dos primeros números.
  - «Novedades» abre una ventana con `publico` de la última versión: frases cortas, sin nada técnico, del Equipo ni de seguridad.
- **Para el Equipo:**
  - abajo a la derecha del panel, «Versión 1.9.0 · Ver cambios»;
  - la página nueva `/equipo/versiones` muestra todas las versiones, de la más nueva a la más antigua, con el detalle completo.

**Novedades de la 1.9 para las tiendas:**

- Recién publicado ahora se recorre fila por fila.
- Tu logo se ve en todo el sitio.
- Ya están las 7 galerías de Wilson.
- La ficha de cada producto se lee más clara.

**Versión 1.9.0 para el Equipo:**

- **Nuevo:**
  - Equipo › Galerías: agregar, ordenar y ocultar galerías, y los avisos de «Otra galería».
  - Plantilla del catálogo en Excel con una pestaña por categoría; el importador lee todas las pestañas.
  - Barra de avance al subir el ZIP: «Subiendo %» y «Revisando filas».
  - Recién publicado en 4 filas con flecha por fila (hasta 18 por fila) y «Ver todas».
- **Cambia:**
  - Ícono de «Publicación rápida»: rayo de línea verde, ya no amarillo.
  - Ficha del producto: fondo, bordes y tablas más marcados.
  - Logo de la tienda en la cabecera, el inicio, la ficha, los mensajes y el piloto.
  - «Hace X» pasa debajo de la tarjeta.
  - Los errores del ZIP dicen el motivo, con conteo por tipo.
- **Datos:** se agregan 5 galerías: CompuPlaza, Galerías Garcilaso, Galería Centro de Lima, Compu Wilson y Galería Global.com.

## Cuándo está terminado

- [ ] El rayo de «Publicación rápida» es de línea verde sobre verde clarito, y «A mano» va sobre negro, con cualquiera de las dos pestañas elegida.
- [ ] «Descargar la plantilla» baja un .xlsx. Al abrirlo en Excel en español, cada dato sale en su columna, y se puede llenar dos pestañas, meterlo en un ZIP con `fotos/` y subirlo.
- [ ] Crear cuenta, Configuración y Wilson en vivo muestran las 7 galerías en el orden de Equipo › Galerías.
- [ ] La ficha se ve como el tablero 4, en web y en celular.
- [ ] El inicio normal muestra 4 filas: la flecha se ve transparente y se pone negra con el cursor, cada fila se desliza sola, y el final de la fila y el botón «Ver todas» aparecen en los casos descritos.
- [ ] Una tienda con logo lo ve en todos los lugares del punto 6.
- [ ] Un ZIP de 35 MB muestra el porcentaje y después «Revisando…».
- [ ] Un ZIP con filas malas muestra los motivos y los textos nuevos.
- [ ] El pie dice «PaseLibre 1.9 · Novedades», y `/equipo/versiones` muestra la 1.9.0 con el detalle.