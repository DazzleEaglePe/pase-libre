# 17 · Catálogo: fotos, ZIP que actualiza y «Eliminar todos»

**Fecha:** jueves 12/11/2026 · **Estado:** aprobado por Bruno (diseño); en producción desde el 12/11/2026, `0bb30bd6` (ver CHECKLIST §13) · **Para:** Bruno (desarrollo)

Esto **se suma** a la ronda 11/11 + feed ([docs/14 §7](14-lienzo-final.md), en producción desde el 12/11); no cambia nada de lo que ya está ahí. Sale de una conversación sobre las fotos del catálogo. El catálogo nuevo (302 productos con fotos elegidas con una guía nueva) **está listo para subir apenas exista el punto 3**.

Las maquetas están en el artifact **«Panel del catálogo»**. Es privado: Bruno (diseño) tiene que compartirte el enlace.

| # | Qué | Tam. |
|---|---|---|
| 1 | Fondo gris clarito detrás de cada foto de producto | S |
| 2 | En Catálogo, «Editar» cambia todo, incluidas las fotos y la portada, con aviso si hay publicaciones | S |
| 3 | Subir el ZIP con 3 opciones para lo que ya existe | M |
| 4 | «Eliminar todos» en Catálogo | S |
| 5 | La tienda elige la foto de portada de su publicación | M |
| 6 | nginx: `client_max_body_size 40m` (hoy 9m) | ✅ ya estaba: 41m en la ruta de importar desde la fase 0 ([docs/16](16-seguridad-y-escala.md), H4) |

**Orden sugerido:** 6, 3 y 1 primero, para subir hoy el catálogo nuevo. Después 2, 4 y 5.

---

## 1. Fondo gris clarito en las fotos de producto

Igual que Mercado Libre: un cuadrado gris clarito detrás de cada foto, con la foto «fundida» en él. El blanco de la foto se vuelve del mismo gris, así que todas se ven como sacadas en el mismo estudio.

- **Dónde:** toda tarjeta o miniatura de producto. Eso incluye el feed (Recién publicado, Lo nuevo), el perfil de la tienda, los resultados de búsqueda, Mis publicaciones, las fotos de la ficha, la franja «Hablan de» del chat y la lista de Catálogo del panel.
- **Cómo:**
  ```css
  .foto-producto { background: #F1F4F2; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; }
  .foto-producto img { width: 86%; height: 86%; object-fit: contain; mix-blend-mode: multiply; }
  ```
  - En la tarjeta, el cuadrado va arriba y el texto abajo, sobre blanco. El borde de 2 px de la ronda 11/11 se queda.
- **Las fotos se guardan en blanco o con fondo transparente.** No se pinta el gris en el archivo, porque `multiply` lo oscurecería dos veces.
- Las fotos con fondo negro o con escenario se ven tal cual dentro del cuadrado. Eso está bien así: no se les quita el fondo.

## 2. Catálogo › «Editar»: todo editable, con fotos

Hoy «Corregir el producto» (`VentanaEditar` en `apps/web/src/features/equipo/catalogo.tsx`) cambia categoría, marca, modelo, versión, código y sinónimos, pero **no las fotos**. Tampoco las acepta `editarCatalogoSchema` (`packages/contracts/src/soporte/panel.ts`).

- **Agregar la sección «Fotos»** con estas acciones:
  - Ver las fotos del producto.
  - «+ Subir foto», con el mismo `POST /v1/archivos` que ya usa «Agregar».
  - «Quitar».
  - **«Hacer principal»**: la principal es la portada del producto y sale primero.
- **API:** `editarCatalogoSchema` acepta `fotos?: string[]` (rutas, en orden; la primera es la principal). Al guardar, se reemplazan las filas de `ProductoFoto` en la misma transacción.
- **Aviso antes de guardar:** si hay ofertas vigentes con ese `productoId`, aparece la ventana:
  > **¿Estás seguro?** Se van a actualizar las **3 publicaciones** que usan este producto.
  > [Cancelar] [Sí, guardar]

  Si nadie lo usa, se guarda directo.
- **Qué les pasa a las publicaciones:**
  - El nombre, la versión y la categoría cambian en todas (salen de `Producto`).
  - La foto cambia solo en las que usan la foto del catálogo. Si una tienda eligió su propia portada (punto 5), esa se respeta.
- Dejar el cambio en `RegistroEquipo` («Fabrizio cambió las fotos de AMD Ryzen 5 5500»).

## 3. Subir el ZIP: qué hacer con lo que ya existe

Hoy `crearProducto` en `catalogo-equipo.service.ts` devuelve `null` si ya existe un producto con el mismo código o slug, **y no cambia nada**. Por eso los 149 productos que ya se subieron no pueden recibir sus fotos nuevas.

**«Ya existe»** quiere decir: mismo `codigo_parte` (sin importar mayúsculas). Si la fila no tiene código, mismo slug o título exacto.

En la pantalla **«Revisión antes de guardar»** que ya existe:

- **Resumen arriba:** «153 nuevos: se crean» · «149 ya existen» · «0 con errores».
- **«¿Qué hacemos con los 149 que ya existen?»**, tres opciones. Por defecto va marcada «Reemplazar fotos y datos».
  1. **Dejarlos como están:** solo se crean los nuevos (lo de hoy).
  2. **Reemplazar solo las fotos:** se reemplazan sus `ProductoFoto` por las del ZIP. Nombre, versión y código no cambian.
  3. **Reemplazar fotos y datos:** todo lo de la fila (fotos, categoría, marca, modelo, versión y sinónimos). Sirve cuando el archivo corrige una versión mal puesta (OC, Ti, Super…).
- **«Lo que cambia»:** lista de los productos que se van a tocar.
  - Cada uno con su foto de antes → foto nueva, y los datos que cambian resaltados («Modelo: RTX 5060 → **RTX 5060 Ti**»).
  - Cada uno tiene **una casilla marcada**; si la desmarcas, ese producto no se toca.
  - Muestra los primeros y «Ver los 146 restantes ›».
- Si la opción toca productos con publicaciones, decirlo: «12 de estos tienen publicaciones: se van a actualizar». La regla de la foto es la del punto 2.
- **Aviso de parecidos:** «3 parecidos con código distinto: mismo nombre que uno del catálogo, pero otro código. Revísalos antes, para que no se dupliquen». El servicio ya calcula `parecido` y `duplicados`.
- **Botón:** «Guardar: crear 153 y actualizar 149».
- Al reemplazar fotos, borrar los archivos viejos **después** de que la transacción salió bien, nunca antes.

Con esto, Bruno (diseño) sube siempre **el mismo ZIP completo**: los nuevos se crean y los que ya están se corrigen, sin tocar nada a mano.

## 4. «Eliminar todos» en Catálogo

- **Botón rojo con borde** «Eliminar todos», junto a «Subir archivo». Solo para el Equipo.
- **Al tocarlo:**
  > **¿Estás seguro de que quieres eliminar 302 productos?**
  > Se borran del catálogo con sus fotos. **No se puede deshacer.**
  > *16 se quedan: los usan tiendas en sus publicaciones. Se eliminan los otros 286.*
  > [Cancelar] [Sí, eliminar 286]
- **Solo se borran los productos que no tienen ninguna `Oferta`** (de ningún estado). Los que tienen ofertas se quedan; así ninguna publicación se queda sin producto.
- Mientras borra: «Eliminando productos… 140 de 286 · no cierres esta ventana». Borrar por tandas, no todo en un solo pedido largo.
- Al terminar: «Listo: se eliminaron 286 productos. Quedan 16 que usan las tiendas. Ya puedes subir el catálogo nuevo».
- Borrar también sus fotos (`ProductoFoto` y los archivos) y sus sinónimos. Dejarlo en `RegistroEquipo`.

## 5. La tienda elige la foto de portada

Hoy el feed, los resultados y Wilson en vivo usan **`producto.fotos[0]`** (`catalogo.service.ts`, `wilson.service.ts`, `ofertas.service.ts`). Las fotos propias de la tienda (`OfertaFoto`) no salen como portada.

- **Al publicar** (rápida y a mano) **y al editar** en Mis publicaciones:
  - Se ven juntas la foto del catálogo y las de la tienda.
  - Al tocar una, se marca **«★ Portada»**.
  - Por defecto, la portada es la del catálogo, si hay; si no, la primera de la tienda.
- Debajo, el consejo: «Una foto con fondo claro y el producto completo se ve mejor en el inicio».
- **Base:** algo como `Oferta.portadaRuta` (nulo = usar la del catálogo).
- **Donde hoy se usa `producto.fotos[0]`**, usar la portada de la oferta y, si no tiene, la del producto.
- Cualquier foto se muestra con el fondo gris del punto 1.

## 6. nginx

> **Ya estaba hecho** (12/11/2026): producción tiene `client_max_body_size 41m` en `location = /v1/equipo/catalogo/importar` desde la fase 0 de docs/16. Si el ZIP pasa de 40 MB, hay que subir a la vez `MAX_BYTES_ARCHIVO` de la API y ese límite.

`client_max_body_size 40m` en el sitio de la API, igual que el límite de la API. Hoy está en 9m, y el ZIP del catálogo tuvo que partirse en dos.

---

## Cuándo está terminado

- [ ] Subir el ZIP completo dos veces seguidas con «Reemplazar fotos y datos» no duplica nada
- [ ] Editar un producto con publicaciones avisa cuántas y las actualiza; una tienda con portada propia la conserva
- [ ] «Eliminar todos» nunca borra un producto con ofertas
- [ ] Las tarjetas de producto se ven con el gris en web 1440 y celular 390
- [ ] Pruebas nuevas de API (importar con las 3 opciones y eliminar) y `pnpm lint`, `typecheck` y `test` en verde
