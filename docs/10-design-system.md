# 10 · Design system

**Versión:** 0.1 · **Fecha:** 28/10/2026 · **Responsable:** Dazz, para revisar con Grimm y My

La línea gráfica **Hielo** (D-52) y cómo se usa en la web: color, tipografía, medidas, íconos, logo, componentes y voz. Las pantallas y sus recorridos están en el [documento 09](09-ux-y-flujos.md).

**Dónde vive cada cosa:**

| Qué | Dónde | Es la fuente de verdad de |
| --- | --- | --- |
| Tokens | [`packages/ui/src/index.ts`](../packages/ui/src/index.ts) | Colores y escala tipográfica. La web los usa como tema de Tailwind; la futura app podrá leer los mismos |
| Hoja de marca | [`branding/hoja-de-marca.html`](../branding/hoja-de-marca.html) | El logo, sus usos, los contrastes, los íconos y la voz, todo en una página |
| Logos e íconos | [`branding/logo`](../branding/logo) (SVG) y [`branding/png`](../branding/png) | Favicon, ícono de la app, vista al compartir (`og.png`) |
| Componentes | [`apps/web/src/shared/ui`](../apps/web/src/shared/ui) | Barras, buscador, campanita, ventanas y controles |
| Recetas de clases | [`apps/web/src/shared/ui/estilos.ts`](../apps/web/src/shared/ui/estilos.ts) | Campos y botones |

**Historia corta:** el lienzo empezó con tinta y lima, con Space Grotesk y Plus Jakarta Sans; pasó a Inter (D-49); y el 27/10 se eligió Hielo entre cuatro propuestas (Papel, Hielo, Musgo y Noche, en [`branding/propuestas`](../branding/propuestas/index.html)). La web ya está en Hielo; **el lienzo de diseño sigue en Inter y lima** y falta pasarlo.

---

## 1. Principios

1. **Poco color.** Azul noche y blanco hacen casi todo. El azul pase aparece solo para actuar.
2. **Un botón principal por pantalla.** Es el único en azul pase.
3. **Una familia y una escala.** Figtree en 400, 500 y 600, y ocho niveles de texto. Nada fuera de la escala.
4. **Se lee en la galería.** Contraste de 4,5 : 1 como mínimo para todo texto y botones de 44 px como mínimo (RNF-07), porque se usa de pie, con el celular y con luz de tienda.
5. **El color no decora.** Nada de íconos dentro de cuadrados de color.

## 2. Color

| Token | Valor | Para qué |
| --- | --- | --- |
| `tinta` (azul noche) | `#0A1633` | Texto, fondos oscuros y avatares |
| `pase` (azul pase) | `#2F5BFF` | Actuar: el botón principal, el símbolo y los contadores |
| `pase-suave` | `#EAF0FF` | Fondo de lo elegido o resaltado |
| `acento` | `#8FA9FF` | El símbolo y los subrayados **sobre fondo oscuro**. Nunca como texto sobre blanco |
| `superficie` | `#F2F4F8` | Fondos de tarjetas, campos y fichas |
| `linea` | `#E3E7EF` | Separadores y bordes suaves |
| `borde` | `#C8CFDD` | Bordes de tarjetas e interruptores apagados |
| `borde-control` | `#66728F` | Bordes de campos y botones (3 : 1 como mínimo) |
| `secundario` | `#2E3A5A` | Texto de apoyo |
| `detalle` | `#5A6785` | Notas, fechas y ayudas |

**Estados** (texto sobre su fondo):

| Estado | Texto | Fondo | Para qué |
| --- | --- | --- | --- |
| `ok` | `#0B6B4A` | `#DDF4EA` | Confirmado, visible |
| `aviso` | `#8A3F00` | `#FFF0E3` | Para revisar («Revísala») |
| `error` | `#8A1C12` | `#FDECEA` | Algo falló |

**Contrastes** (WCAG; 4,5 : 1 es el mínimo para texto):

| Pareja | Contraste | ¿Para texto? |
| --- | --- | --- |
| Azul noche sobre blanco | 17,9 : 1 | Sí |
| Secundario sobre blanco | 11,2 : 1 | Sí |
| Acento sobre azul noche | 7,9 : 1 | Sí |
| Detalle sobre blanco | 5,7 : 1 | Sí |
| Blanco sobre azul pase (botón principal) | 5,2 : 1 | Sí |
| Detalle sobre superficie | 5,1 : 1 | Sí |
| Borde de control sobre blanco | 4,8 : 1 | Para bordes |
| Ok, aviso y error sobre su fondo | 5,7 a 8,1 : 1 | Sí |
| **Acento sobre blanco** | **2,3 : 1** | **No** |

## 3. Tipografía

**Figtree**, de código abierto (licencia SIL OFL), cargada con `next/font` en la variable `--fuente-base`. La interfaz usa 400 (texto), 500 (etiquetas y enlaces) y 600 (títulos y botones).

| Token (`text-…`) | Tamaño / alto de línea | Peso | Para qué |
| --- | --- | --- | --- |
| `titulo` | 28 / 36 | 600, −0,01 em | Título de la página |
| `seccion` | 20 / 28 | 600 | Título de una sección |
| `precio` | 18 / 24 | 600 | El precio en la ficha y las tarjetas |
| `tarjeta` | 16 / 24 | 600 | Título de una tarjeta o fila |
| `cuerpo` | 15 / 22 | 400 | Texto normal, campos y botones |
| `apoyo` | 14 / 20 | 400 | Texto secundario y botones de lista |
| `nota` | 13 / 18 | 400 | Fechas, ayudas y notas |
| `etiqueta` | 12 / 16 | 600, +0,06 em | Etiquetas cortas en mayúsculas sobre una lista («Ya está en PaseLibre») |

## 4. Medidas y forma

**Alturas** (RNF-07):

| Uso | Alto | Clase |
| --- | --- | --- |
| Campos de formulario y botones de formulario | 48 px | `h-12` |
| Botones | 44 px | `h-11` |
| Botones dentro de listas | 40 px | `h-10` |

**Contenido:** hasta 1280 px de ancho, con 16 px de margen lateral en el celular y 32 px desde `sm`.

**Esquinas, hoy en la web:**

- Botones, píldoras y avatares: completamente redondos (`rounded-full`).
- Campos: 12 px (`rounded-xl`).
- Tarjetas y ventanas: entre 12 y 24 px.

**Pendiente:** Hielo pide botones de 10 px y tarjetas de 12 px. Se dejaron las píldoras para no rehacer la web antes de salir; es un ajuste aparte ([checklist](CHECKLIST.md)).

**Recetas** de [`estilos.ts`](../apps/web/src/shared/ui/estilos.ts):

| Receta | Cómo se ve | Cuándo |
| --- | --- | --- |
| `botonPrincipal` | Azul pase, texto blanco | La acción principal de la pantalla; una sola |
| `botonSecundario` | Blanco con borde | Las demás acciones |
| `botonPeligro` | Rojo de error, texto blanco | Acciones que borran o cortan algo |
| `botonLista` | Blanco con borde, 40 px | Acciones dentro de una fila |
| `enlaceBoton` | Texto subrayado | Acciones menores |
| `campo` y `etiqueta` | Campo de 48 px con su etiqueta encima | Formularios |

## 5. Íconos y logo

**Íconos:** de línea, sobre una rejilla de 24, con trazo de 1,5, extremos y uniones redondeados, sin relleno y en azul noche. **Nunca dentro de un cuadrado de color:** el color es del azul pase, y el azul pase es para actuar. Las categorías sin foto usan su propio glifo (`glifo-categoria.tsx`). En la web, los demás salen de [Tabler](https://tabler.io/icons) (`@tabler/icons-react`, versión fija) con `stroke={1.5}`: los controles (pausa, flechas, cerrar) y las marcas (WhatsApp, Facebook, Instagram y TikTok), que así tienen el mismo trazo que el resto.

**Logo:** una entrada con muesca y una flecha (el «pase»), junto a la palabra PaseLibre.

| Pieza | Archivos | Mínimo |
| --- | --- | --- |
| Horizontal | `horizontal.svg` y sus versiones `-blanco`, `-oscuro`, `-tinta` | 96 px de ancho (25 mm) |
| Vertical | `vertical.svg` y sus versiones | 64 px de ancho (18 mm) |
| Símbolo | `simbolo.svg`, `-acento`, `-blanco`, `-tinta` | 32 px (8 mm) |
| Ícono de app | `icono.svg`; de 16 a 32 px, `favicon.svg` | 32 px |

- **Espacio libre:** alrededor del logo queda libre la mitad del alto del símbolo, sin textos, bordes ni imágenes encima.
- **En la web** (`marca.tsx`): la palabra toma el color del texto, así sirve en la barra clara y en la oscura del equipo; el símbolo va en azul pase y, sobre fondo oscuro, en el acento.
- Las letras del logo ya son trazos: no hace falta tener la fuente para usarlo.

## 6. Voz

Hablamos como una tienda de galería con otra: **de tú, directo y sin adornos.**

| Sí | No |
| --- | --- |
| «Publicar», «Guardar cambios» | «Enviar datos», «Haz clic aquí» |
| «Esa cuenta está suspendida. Reactívala o elige otra.» | «Error 409: operación no permitida» |
| «Cambios guardados.», «Listo: 8 publicaciones pasaron a Kevin S.» | «¡Operación realizada exitosamente!» |
| Decir qué hacer cuando una lista está vacía | «No hay datos» |

- **Mayúscula solo al empezar:** «Mis publicaciones», no «Mis Publicaciones».
- **Sin «por favor», sin «exitosamente» y sin signos de exclamación.** El único es el saludo «¡Hola, Tienda A!».
- **Precios y fechas como en el catálogo:** «US$ 250», «S/ 1,699.99», «Hoy», «Ayer», «Hace 9 días».

**Palabras:**

| Palabra | Quiere decir |
| --- | --- |
| pase | El trato entre dos tiendas. PaseLibre no interviene en la venta |
| producto | El modelo del catálogo, una sola vez: marca, modelo y fotos base |
| publicación / oferta | Lo que una tienda tiene de un producto: «publicación» en su lista, «oferta» en la ficha |
| Al interno | El precio que no se muestra. Quien quiere saberlo consulta por mensaje o WhatsApp |
| tienda | También quien vende sin galería. Las personas son «vendedores» |

## 7. Componentes

En [`apps/web/src/shared/ui`](../apps/web/src/shared/ui):

| Componente | Qué es |
| --- | --- |
| `cabecera` | La barra de arriba (C_Header): fila del saludo y la galería, logo con frase, buscador, banda de categorías y franja de ventajas; igual con sesión y sin ella |
| `buscador` | El buscador de la barra: campo, selector de categoría desde tablet y «Buscar» aparte; su desplegable trae recientes, lo más buscado y productos sugeridos |
| `menu-categorias` | «Comprar por categoría»: el panel con las categorías y sus marcas, estado y galerías |
| `campanita` y `contador` | Los avisos y las insignias |
| `menu-cuenta` | El menú del avatar |
| `marca` | El logo |
| `glifo-categoria` | El ícono de cada categoría, para productos sin foto |
| `miniatura` | La foto pequeña de un producto |
| `interruptor` y `segmentado` | Controles de sí o no y de opciones |
| `ventana` | Las ventanas de confirmación («Vendido», bloquear, eliminar) |
| `pie-pagina` | El pie con columnas (C_Footer), en el catálogo y en las páginas del vendedor. Su columna Contacto lleva íconos de Tabler en círculos grises (WhatsApp, correo, reloj y las redes, que al pasar el mouse se ponen en azul noche) y lee sus datos de `shared/contacto.ts` |
| `pie-compacto` | El pie de una línea (C_FooterCompacto), en Mensajes y en el panel del equipo |

## 8. Cómo se cambia

- **Un color o un tamaño:** se edita `packages/ui/src/index.ts`, se reconstruye el paquete (`pnpm typecheck` o `pnpm build`) y se borra `apps/web/.next`; si no, Tailwind sigue sirviendo los valores viejos.
- **El logo, los íconos o la hoja de marca:** se editan en `branding/` y se regeneran con `cd branding && npm install && npm run generar`. Eso rehace los SVG, los PNG, el favicon, la vista al compartir, la hoja de marca y los archivos de la web.
- **Algo nuevo en la interfaz:** sale de un token. Si hace falta un color o un tamaño que no existe, se agrega primero a `packages/ui` y a la hoja de marca, no directo en una pantalla.
