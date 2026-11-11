# 14 · Lienzo «Versión final»: qué falta construir

**Fecha:** domingo 08/11/2026 · **Estado:** análisis y orden propuesto, sin código · **Para revisar con:** Dazz, Grimm, My y Fabrizio

El lienzo **PaseLibre Demo 1** ([enlace](https://claude.ai/artifact/EPB8HopVtygjLksky5HjC7)) tiene una página, **★ VERSIÓN FINAL · todas las pantallas elegidas**, con **163 tableros en 20 secciones** (más una por decidir). Este documento pone cada sección frente a lo que la web ya hace, dice qué falta y propone en qué orden construirlo.

> **Versión que se usa.** Página **★ VERSIÓN FINAL** (id `final`, la primera de las 23 del selector y la que abre el lienzo; [enlace](https://claude.ai/artifact/EPB8HopVtygjLksky5HjC7#page-9539465e2f90)), versión `1794196670-a4d1` del domingo 08/11 a las 10:57 p. m. El lunes 09/11 se comprobó que sigue siendo la última. Las demás 22 páginas son propuestas y comparaciones: si una pantalla de esas choca con la versión final, manda la final.

> **Cómo leer el lienzo.** Cada tablero `FIN_X` solo importa al tablero `X`: el diseño real está en el archivo sin el prefijo (`FIN_BUS_Web` → `BUS_Web`). Las variantes (`BUS_WebSug`, `BUS_WebNum`…) son el mismo archivo con otro estado.
> El lienzo menciona un documento **«PaseLibre · Especificación para desarrollo»** que no está en el repo. Si existe, hay que traerlo: tendrá las reglas que los tableros no muestran.

---

## 1. Lo que hay que decidir antes de empezar

| # | Decisión | Por qué importa | Propuesta |
|---|---|---|---|
| L-1 | **Paleta.** El lienzo final está en **verde esmeralda** y la web estaba en **Hielo** azul (D-52) | Cambia el color de toda pantalla que se construya | **Decidido el 08/11: verde esmeralda (D-54).** Tokens, logo e íconos ya cambiados; la barra de arriba sigue blanca y pasa a verde con la sección 1 (§2) |
| L-2 | **Nombres.** El lienzo dice «Pedidos en vivo» y «Remato»; el código dice «Pases del día» y `FLASH` (D-53) | Textos, rutas y avisos | Decidir uno. Cambiar el texto es barato; la ruta `/pases-del-dia` lleva redirección |
| L-3 | **Chat por tienda.** El lienzo muestra un chat por pareja de tiendas, con los productos como tarjetas adentro. La base guarda un chat por oferta y comprador (`@@unique([ofertaId, compradorId])`) | Es el único cambio que toca datos existentes | Para salir: agrupar por tienda **en la bandeja** sin tocar la base. Migrar el modelo después, si hace falta |
| L-4 | **Lo que era fase 2 y el lienzo trae adentro:** registro propio y aprobación (RF-01, RF-04), precio por rol (RF-37), reputación, seguir y tienda pública (RF-63 a RF-65), aviso fuera de la app (RF-42) | Cambia el alcance de la primera salida | Confirmar con Fabrizio qué entra al piloto y actualizar los documentos 02 y 04 |
| L-5 | **Proveedores externos:** SMS para el código del registro, consulta de RUC a SUNAT, avisos push con el celular bloqueado, descarga en Excel | Algunos tardan días en contratarse | Empezar los trámites ya, aunque el código llegue después |
| L-6 | **Nombres pendientes que el propio lienzo deja abiertos** (tablero «Lo que falta»): insignia de la lista («Recomendado» o «Más vendido»); nombre del precio especial («Socio», «pata», «amigo» o «preferente»); revisión legal de términos, privacidad y libro de reclamaciones | Textos y una tabla sin dueño (hoy «Recomendado» no tiene campo) | Que Grimm y My elijan; el abogado, aparte |
| L-7 | **«Por decidir»:** cotización con toda la galería (`CAT_Web2` y `CAT_Cel2`) | No la eligieron todavía | Fuera hasta que decidan |

## 2. Sección por sección

**Hecho** = ya está en la web (no necesariamente en `main`: ver §5). **Parcial** = existe una parte. **Nuevo** = no hay nada. Tamaño: S = un día o menos, M = 2 a 3, L = una semana, XL = más de una semana o depende de un proveedor.

| # | Sección (tableros) | Hoy | Falta | Tam. |
|---|---|---|---|---|
| 1 | **Barra y «Todas las categorías»** (4) · `D_Barra`, `CAT_Web1`, `NAVB_CelB`, `CAT_Cel1` | Parcial: barra fija y menú J | Entradas «Remates de hoy», «Recién llegados +N hoy», «De tiendas que sigues», «Wilson en vivo» y «Ayuda» (abre el chat con el equipo). En el menú, columna con «Pedidos en vivo» y «Lo más buscado hoy» (sale de la tabla `Busqueda`). En celular, burbujas con destacados | M |
| 2 | **Primer ingreso, estilo B** (5) · `OB_Web`, `OB_Cel` | Parcial: solo el cambio de clave | 4 pantallas de bienvenida con «Saltar», una sola vez (columna nueva en `Usuario`) | S |
| 3 | **Registro de tienda** (12) · `REG_Web`, `REG_Cel` | Nuevo: solo cuentas que crea el equipo (RF-35) | Solicitud propia: celular con código por SMS, RUC contra SUNAT, camino «sin RUC» (DNI, una tienda verificada que te conozca, credencial del stand), galería, stand, horario, fotos, revisión de una persona en máx. 3 h y la cola en el panel | XL |
| 4 | **Iniciar sesión** (2) · `D_Acceso`, `M_Acceso` | Hecho | Solo el color | S |
| 5 | **Inicio: crece solo** (9) · `FI_Web`, `FI_Cel`, `FI_*Normal`, `SG_*Feed`, `D_Portada` | Parcial: Recién publicado y el carrusel | Variantes por cantidad (día 1, primera semana, 2 filas de 6 mezcladas por tienda), «De tiendas que sigues» y la portada de visitante | M |
| 6 | **Buscador que nunca te deja sin nada** (8) · `BUS_Web`, `BUS_Cel` | Parcial: corrige errores de tipeo (RF-13) | Sugerencias mientras escribes, números en palabras («treinta sesenta» → 3060) y, sin resultados exactos, parecidas + «Pedirla en vivo» + «Avísame cuando alguien la publique» | L |
| 7 | **Resultados y ficha** (6) · `D_Resultados`, `D_Ficha`, `M_*` | Hecho, **sin commit** (§5) | Pasarlo a la paleta final | S |
| 8 | **Wilson en vivo, seguidas y categoría** (8) · `CAT_Web3`, `CAT_Web4`, `SEG_Web`, `CAT_Cel3/4`, `SEG_Cel` | Parcial: `/buscar` filtra por galería | Página por galería con «Tiendas por piso», página de categoría (Gráficas) y «De tiendas que sigues» | L |
| 9 | **Pedidos en vivo: ver, Busco y Remato** (8) · `D_Pases`, `M_Pases`, `PUB_*Vivo` | Hecho como «Pases del día» (L-2) | Nombres y revisar el flujo de 3 pasos | S |
| 10 | **Publicar producto** (10) · `PUB_WebProducto`, `PUB_CelProducto` | Parcial: catálogo, fotos, «Publicar uno igual» | «Publicación rápida» (escribes «gigabte 30 60» y eliges) y el bloque de precio con «pase» y «facturado» | M |
| 11 | **Precio socio y tus socios** (4) · `PS_Precio`, `PS_SociosWeb/Cel` | Nuevo: `Oferta` guarda un solo precio | Tabla de socios, precio pase y precio facturado (con IGV) y quién ve qué: tienda cualquiera, socio, sin sesión («Precio por chat», «Pedir precio») | XL |
| 12 | **Mis publicaciones** (4) · `MP_Web`, `MP_Cel` | Hecho en lo principal | «Vendidos del mes», pausar y «Revísala» en celular | S |
| 13 | **Chat por tienda, fotos, cómo llegar, cerrar la venta** (15) · `PCH_*`, `SIM_Chat` | Parcial: fotos, «Vendido» con comprador, respuestas rápidas | Ver L-3. Falta «cómo llegar al stand», calificar al cerrar y la lista con una fila por tienda. `SIM_Chat` es un simulador para la demo, no se construye | XL |
| 14 | **Tu perfil y tu cuenta** (8) · `P_WebCuentaD2`, `D_Cuenta`, `M_Cuenta` | Parcial: Configuración | Perfil D2 con el «ojito» (cómo te ven las demás) y «Tu cuenta» con atajos y contadores | M |
| 15 | **Perfil de otra tienda: seguir y opiniones** (6) · `SG_Web`, `SG_Cel` | Nuevo | Tablas de seguimiento y de opiniones; solo opina quien le compró (sale de `Venta`); la tienda responde; el mensaje de la primera vez | L |
| 16 | **Historial con celebraciones** (4) · `HI_A2_Web`, `HI_A2_Cel` | Parcial: la tabla `Venta` | Página «Mis ventas y compras», medallas a los 10 y 20 items y descarga en Excel | M |
| 17 | **Avisos (la campanita)** (6) · `AV_*` | Parcial: campanita y preferencias | Acciones dentro del aviso (Aceptar, «Ahora no», «Sumar 1 hora», «¡Lo tengo!»), filtros, configuración con horario silencioso y avisos con el celular bloqueado | L (el push: XL) |
| 18 | **Reportar, bloquear y chat oficial del equipo** (20) · `REP_*` | Parcial: `Denuncia`, `Bloqueo` y el menú ⋯ | Flujo de 3 motivos con detalle y «qué sigue», «Mis reportes», «Tiendas bloqueadas» con deshacer y el chat oficial (fijado arriba, insignia «Oficial», el equipo escribe primero) | L |
| 19 | **Estados vacíos y errores** (11) · `EV_Web`, `EV_Cel` | Parcial | «Pedirla en vivo» y «Avísame», «ya se vendió: otras 3 tiendas la tienen», «sin conexión» con «Reintentar» | M |
| 20 | **Panel del equipo** (11) · `ADM_Web`, `ADM_Cel`, `REG_Admin*`, `REP_WebEquipo` | Parcial: cuentas, clave temporal, traspaso y suspender | Inicio con lo de hoy y números, solicitudes, reportes, tiendas con historial y advertencia, «WhatsApp bloqueados» tras 3 «Ahora no», comunicados y equipo (turnos, horario, actividad) | XL |

**Datos que no existen hoy:** seguimiento, opinión, socio, solicitud de registro, comunicado, turno del equipo, alerta de búsqueda, suscripción push y chat oficial. Lo demás se apoya en tablas que ya están (`Venta`, `Denuncia`, `Bloqueo`, `Aviso`, `EnVivo`, `Busqueda`).

## 3. Orden propuesto

Los diseñadores ordenaron lo que falta así (tablero «Lo que falta»): registro, avisos, perfil y opiniones, reportar y bloquear, panel. Este orden lo respeta, pero mueve el registro porque depende de proveedores:

| Ola | Qué | Por qué en este lugar |
|---|---|---|
| **0** · 1 a 2 días | Decidir L-2 y L-3, hacer commit de lo pendiente (§5) y dejar los colores como variables (con el verde ya puesto, cambiar de paleta otra vez sería solo cambiar valores) | Todo lo demás se construye sobre esto |
| **1** · Confianza | Seguir, perfil de otra tienda y opiniones (§2.15) · Reportar, bloquear, «Mis reportes» y chat oficial (§2.18) | Sin proveedor externo, con tablas chicas, y son lo que más protege el piloto |
| **2** · Avisos | Campanita con acciones, configuración y horario silencioso (§2.17) · estados vacíos (§2.19) | Hacen que Ola 1 se note; el push espera su proveedor |
| **3** · Entrada | Registro con verificación y la cola en el panel (§2.3, parte de §2.20) | El más grande. Mientras tanto el equipo sigue creando las cuentas (RF-35). Empezar el trámite del SMS y de SUNAT durante la Ola 1 |
| **4** · Precio | Precio socio, pase y facturado (§2.11) · historial con Excel (§2.16) | Toca la privacidad de los precios: va con pruebas de contrato nuevas |
| **5** · Estructura | Chat por tienda (§2.13, si L-3 lo pide) · panel completo (comunicados, equipo) · buscador y Wilson en vivo (§2.6, §2.8) · inicio que crece solo (§2.5) | Lo más grande y lo menos urgente para el piloto |

Secciones S (4, 7, 9, 12 y 2) se hacen de paso, junto al color final.

## 4. Cuándo una pantalla está terminada

- [ ] Se parece al tablero `FIN_*` en **celular 390** y **web 1440**, con los textos tal cual
- [ ] Están sus variantes: con sesión, sin sesión y equipo; vacía, con error y cargando
- [ ] Un visitante nunca recibe lo que no debe ver (precio, tienda, WhatsApp): prueba de contrato en la API
- [ ] Texto con contraste de 4,5 : 1 y botones de 44 px (RNF-07); se usa con el teclado
- [ ] Pruebas nuevas de API y de web; `pnpm format:check`, `lint`, `typecheck` y `test` en verde
- [ ] Probada en Chrome sin ventana (celular, tableta y computadora) con `pnpm qa`
- [ ] El [documento 09](09-ux-y-flujos.md) y el [06](06-modelo-de-datos.md) al día, si cambia la pantalla o la base

## 5. Estado del trabajo (11/11)

Las 20 secciones de la página «★ VERSIÓN FINAL» están en `main` (de `c7e3759` a `dfc619d`, uno por sección o por par de secciones), subidas a `origin` y **desplegadas en producción** el 10/11/2026 con la etiqueta `c5efc279`: respaldo previo, las 14 migraciones y prueba de humo en orden. Pruebas al cerrar: API 282, web 27, contratos 38; lint, tipos y formato en verde. Cada pantalla se comparó con su tablero en Chrome sin ventana (computadora 1440 y celular 390).

| # | Sección | Commit | Qué quedó |
|---|---|---|---|
| 1 | Barra y «Todas las categorías» | `c7e3759` | Barra verde, banda negra con Pedidos en vivo, Remates de hoy, Recién llegados, De tiendas que sigues, Wilson en vivo (Nuevo) y Ayuda (con tienda abre el chat con el equipo); burbujas en el celular |
| 2 | Primer ingreso | `a3a4dae` | Bienvenida de 4 pantallas, una sola vez |
| 3 | Registro | `dfc619d` (y el 08/11) | Pasos numerados, «Tu solicitud» y «¿Qué pasa después?»; la referencia del stand pasa a «Cómo llegar» al aprobar |
| 4 | Iniciar sesión | `68c2ab0` | D_Acceso / M_Acceso |
| 5 | Inicio que crece solo | `b756d8d` | `GET /v1/inicio`: fase día 1 / pocas (< 12 de otras tiendas) / normal; «De tiendas que sigues», pedidos en vivo, 2 filas de 6 mezcladas por tienda, precios protegidos, «Lo que más se pide», «Tiendas que ya están», piloto con meta de 20 y «Primeros pasos»; portada de visitante |
| 6 | Buscador | `b756d8d` | Números en palabras, modelos partidos, la categoría nombrada, «Buscar … tal cual», «desde» en el desplegable con sesión, «Ver todo en {categoría}» |
| 7 | Resultados y ficha | `1608483` | D_Resultados, D_Ficha y M_* |
| 8 | Wilson en vivo, categoría, seguidas | `b756d8d` | `/wilson-en-vivo` (mapa de calor, tiendas por piso), `/categorias/<slug>` (precios por modelo con 30 días), `/tiendas-que-sigues` (novedades y sugerencias) |
| 9 | Pedidos en vivo | `99a3988` | D_Pases con «Tus pedidos en vivo»; publicar en 4 pasos con vista previa, «Mostrarlo» y «Avisar a quienes me siguen» |
| 10–11 | Publicar y precio socio | `a931b24` | 6 secciones + publicación rápida; pase, facturado, socio |
| 12 | Mis publicaciones | `cec71c8` | Precio en la fila, pausa con razón, «Vendidos», vistas y chats de la semana |
| 13 | Chat por tienda | `99a3988` | Bandeja por tienda (la base sigue por producto: L-3), «Hablan de», venta cerrada con reclamo de 48 h y calificar, «Cómo llegar», panel de la tienda; chat oficial con el equipo |
| 14 | Tu perfil y tu cuenta | `d5428de` | Vista de dueña con el ojito, `/cuenta` con atajos |
| 15 | Perfil de otra tienda | `0e4ecfc` | Seguir, opiniones y respuesta |
| 16 | Historial | `cec71c8` | Ventas y compras por mes, logros de 10 y 20, Excel, «Recordarle», calificar |
| 17 | Avisos | `f2f56c8` | Campanita con acciones, filtros y horario silencioso |
| 18 | Reportar y bloquear | `74e0d15` | 3 motivos, «Mis reportes», bloqueadas; el chat oficial llegó con la 13 |
| 19 | Estados vacíos y errores | `d79ec8d` | Sin resultados, sin conexión, vitrina vacía |
| 20 | Panel del equipo | `10bfc4d` | Barra propia, inicio con lo de hoy, cola de reportes con decisión, tiendas con advertencias y suspensión, chats y comunicados |

**Datos nuevos (14 migraciones del 10 y 11/11; las de esta tanda):** precio de la venta, vistas por día, razón de pausa, distancia de las galerías (`galeria.metros`, la pone el equipo), precio anterior de la oferta, precio de pase por día (`precio_diario`, se pone al día al abrir la categoría), `en_vivo.mostrar_precio`, `tienda.indicaciones`, chat con el equipo (`hilo_equipo`, `mensaje_equipo`), advertencias, comunicados y `registro_equipo`.

**Se simplificó (para que lo vean Grimm y My):**

- El chat sigue siendo uno por producto: la bandeja junta los hilos por tienda y «Hablan de» salta entre ellos (no hay una sola línea de tiempo mezclada).
- «Contactar por WhatsApp · Toca para pedir permiso», «Tiendas que pueden escribirte» y la sección «WhatsApp bloqueados» del panel no se hicieron: el permiso de WhatsApp todavía no existe.
- «Mostrar el nombre de mi tienda» sigue siendo por publicación (no hay un interruptor de cuenta).
- En la categoría, «Marca» es la marca del producto (MSI, ASUS), no la del chip; no hay filtros de memoria ni versión.
- La distancia «a 3 min caminando» sale solo si el equipo cargó `metros` en las galerías.
- Las opiniones muestran autor y estrellas aunque el lienzo diga «La otra tienda no ve quién dio cada estrella».
- La sección «Equipo» del panel (turnos, horario) no se hizo; «Lo último del equipo» anota reportes, advertencias, suspensiones y comunicados.

**Falta:** subir fotos del stand y de la credencial en el registro; el SMS, la consulta a SUNAT y el aviso con el celular bloqueado (L-5); recordatorios programados; descuento socio por tienda (hoy uno por defecto y otro por publicación).

## 6. Correcciones del lienzo (11/11, versión `1794381822-84cc`)

La página final se renombró «★ VERSIÓN FINAL PARA CONSTRUIR» y sumó 43 tableros: la guía
`GUIA_Construir` («lee esto primero») y las correcciones `COR1` a `COR26`. Los demás tableros
solo cambiaron la letra (se sumó Montserrat). Se construyeron en 7 commits y están en producción desde el 11/11/2026 (`d9ea775b`):

| Parte | Tableros | Commit |
| --- | --- | --- |
| Guía: Inter + Montserrat 800 en mayúsculas para títulos, fondo `#EEF2F0`, bordes de 1,5 px, Brasa para lo «en vivo», «¡Lo tengo!» en naranja sólido, sin «Nuevo» | GUIA_Construir | `b5b4e1f`, `b7ca969` |
| Barra con «Inicio» y la sección marcada en blanco; menú de la cuenta en 3 grupos (también `/cuenta/menu` en el celular) | COR19, COR2, COR22 | `7200f0f` |
| «Inicia sesión» nuevo: frases que cambian y «Te compartieron …» al llegar por el enlace de una tienda (`GET /v1/tiendas/:id/compartida`, solo el nombre). **La raíz no manda a Iniciar sesión**: sin cuenta sigue mostrando la portada pública (sin precios ni tiendas), porque hay páginas que cualquiera puede ver. Es una decisión del 11/11 que se aparta de la guía («paselibre.shop abre en Inicia sesión») | COR3 | `b12adee`, luego la raíz |
| Inicio: saludo con «Pedir algo en vivo» en Brasa, «Pedidos en vivo ahora» y «Recién llegados» en 2 filas de 4 | COR14, COR25 | `b7ca969` |
| Publicar: pestañas Rápida / A mano, «¿Quién ve tu precio?» primero, «Al interno» sin precio, «S/ ▾», «Otro» escrito en estado y garantía, versión y código de parte, «Te falta…» y «Antes de publicar» | COR9, COR12 | `39395cc` |
| Portada del perfil: subir, acomodar, vertical con costados difuminados, automática y quitar | COR1 | `9b465b3` |
| Panel: claro u oscuro en la cuenta, Catálogo (productos, por revisar, subir .xlsx/.csv/.zip, agregar uno) y Destacar en silencio | COR15 a COR18 | `10fb470` |

**Datos nuevos (5 migraciones del 11/11):** `oferta.estado_otro` y `garantia_otra` con los
valores `OTRO` y `OTRA`; `producto.version` y `codigo_parte` (único); soles por defecto
(también pasa a soles a las tiendas que ya están); la portada de la tienda; y `usuario.tema_oscuro`,
`destacado` e `importacion_catalogo`.

**Simplificaciones:**
- LEMON MILK no está en Google Fonts y falta confirmar su licencia: se usa Montserrat 800.
- «Usar la foto de mi stand» queda deshabilitada hasta que el registro guarde esa foto.
- La portada automática toma sus colores del nombre de la tienda (no hay logo del que sacarlos).
- Publicar en el celular sigue siendo la misma página larga, no los 5 pasos de `COR9_PubCel`.
- «Unir con este» no une si la misma tienda tiene publicados los dos: pide quitar uno primero.
- En «Agregar uno», Chip, Memoria y Tipo de memoria van siempre (son los del tablero, de
  tarjetas de video); en el archivo, cualquier otra columna entra como característica.
