# 20 · Versión 1.11.0: arreglos y novedades

**Fecha:** viernes 13/11/2026 · **Estado:** aprobado por Fabrizio (diseño), sin código · **Para:** Bruno (desarrollo)
**Versión:** de 1.10.0 pasa a **1.11.0**. Va todo junto, en una sola subida.

Esto **se suma** a los documentos 16 a 19 y **reemplaza** la nota suelta `para_bruno_20_buscador_y_fondo_blanco.md`, que ya no hay que usar. En esa nota dije que «5600XT» fallaba por ir pegado; es falso: `normalizarTexto` ya separa letras de números. Aquí queda corregido.

Lo revisé contra `main` en **`3a65376`** («Inter y Montserrat dentro del repo»). Los números de línea son de ese commit y pueden moverse un poco.

**Dónde ver cada pantalla:** el lienzo «PaseLibre Demo 2» de tu cuenta, https://claude.ai/artifact/RzQKVgD6cqUs5ihp44HThz, sección «Pulido de las propuestas». Empieza por el tablero **P57 · Revisión**: es la lista de todo lo decidido. Los tableros con animación (P58 y P60) se mueven al hacerles doble clic. Las mismas pantallas están en `fotos/` como imagen. El nombre de cada foto empieza con el número del punto.

---

## Índice

### A · Errores (primero)

| # | Qué | Tam. |
|---|---|---|
| A1 | **Campanita:** el número vuelve con F5 y tocar un aviso no apaga su puntito | M |
| A2 | Publicar «a nombre de la tienda» en modo soporte da error | S |
| A3 | Pedidos en vivo: la página no muestra la foto (punto 8) | M |
| A4 | «Cómo llegar» y «Sobre la tienda» son opcionales y no cuentan para «Perfil al N %» (punto 9) | S |
| A5 | Al editar dice «¡Listo! Ya puedes publicar» (punto 17) | S |
| A6 | Ficha del producto: no mostrar las burbujas de sinónimos | S |
| A7 | Importar catálogo: un sinónimo largo da error 500 | S |
| A8 | RAM publicada antes de la 1.10.0: tomar Intel / EXPO del producto | S |
| A9 | Panel › Catálogo, «muy parecido»: la palabra que cambia, en negrita | S |

### B · Novedades

**Lo que se ve en todas las tarjetas**

| # | Qué | Tam. |
|---|---|---|
| 3 | Fondo blanco en fotos y tarjetas; fotos nuevas horizontales (dato de Fabrizio) | S |
| 18 | Línea gris fina entre la foto y el nombre | S |
| 19 | Al pasar el cursor: la tarjeta se pinta menta y aparece la flechita «›» | S |
| 21 | La burbuja del precio no cambia; la búsqueda agrupa por producto (ya existe, revisar) | S |

**Inicio**

| # | Qué | Tam. |
|---|---|---|
| 4 | Página más ancha (1440), 5 por fila, 4 filas y paginación | M |
| 22 | Inicio sin títulos: una sola grilla y la chapita blanca al pasar el cursor | M |
| 4b | Orden por puntos, tope por tienda en cada fila y «Destacar» con fuerza | L |
| 7 | «Piloto» pasa a «Tiendas fundadoras» (solo 10) | L |

**Tiendas y publicaciones**

| # | Qué | Tam. |
|---|---|---|
| 5 | Perfil Público / Privado / Oculto y el botón «Cómo me ven» | L |
| 8 | Página Pedidos en vivo: foto alta a la izquierda de cada tarjeta | M |
| 11 | Un solo buscador para todo, que entiende categoría + marca + tipo | L |
| 14 | Botón «Editar» en cada publicación | S |
| 16 | «Pausar» pasa a «No disponible ▾» con su motivo | M |
| 20 | Perfil de tienda: «Lo nuevo de esta semana», «Sus mejores precios» y «Todo» | M |
| 23 | Ficha del producto: foto horizontal en blanco y miniaturas debajo | M |

**Panel del Equipo**

| # | Qué | Tam. |
|---|---|---|
| 6 | Menú en dos pisos (también arregla el 12: «Catálogo» cortado) | S |

**Orden sugerido:** A1 a A9 (los errores, cortos y uno delicado) → 3, 18, 19 y 6 (estilos) → 14, 16 y A5 → 4 y 22 → 4b → 7 → 11 → 8, 20 y 23 → 5 (el más grande; toca búsqueda, inicio, perfil y avisos).

---

# A · Errores

## A1. Campanita: el número vuelve con F5 y tocar un aviso no apaga su puntito

Fabrizio lo pidió con mucho cuidado: es lo que más molesta hoy. **Lee esta parte completa antes de tocar código.**

### Lo que se ve

1. Hay 9 avisos. Abre la campana: el número desaparece.
2. Da F5, o va al Inicio, o a cualquier otra página: **vuelve el 9**.
3. Toca un aviso: no baja a 8 y el puntito naranja de ese aviso **no se apaga** (al volver, sigue ahí).

### Cómo debe quedar (lo acordado en el doc 19 §15, no cambia)

- **El número naranja** se va al abrir la campana y **no vuelve**: ni con F5, ni al cambiar de página, ni en otra pestaña, ni en el celular. Solo vuelve a subir cuando llega algo nuevo de verdad.
- **El puntito de cada aviso** queda hasta tocar ese aviso. Al tocarlo se apaga y no vuelve.
- **«Marcar todo como leído»** apaga todos los puntitos.

### Por qué pasa: cuatro causas

**1 · Las fallas son silenciosas (esto hace que todo lo demás no se note).**

`apps/web/src/shared/avisos-leidos.ts`:

- `marcarAvisoLeido` y `marcarAvisosVistos` bajan el número en pantalla al toque, con un evento de la pestaña.
- Después mandan el `POST` con `.catch(() => undefined)`.

Si la API dice que no, nadie se entera: en pantalla quedó 0, pero en la base no cambió nada. Al dar F5 o cambiar de página, `useContadores` (`shared/ui/campanita.tsx:30`) vuelve a pedir `/contadores` y aparece el 9 otra vez. El puntito también vuelve, porque `leidoEn` sigue en `null`. **Es exactamente lo que vio Fabrizio.**

**2 · Por qué dice que no: el modo soporte (causa confirmada en el código).**

`SesionGuard` (`apps/api/src/shared/guards/sesion.guard.ts:116-124`) bloquea todo lo que no sea GET si el endpoint no tiene `@PermitirEnSoporte`.

- `POST /avisos/vistos` y `POST /avisos/leidos` (`mensajes.controller.ts`, ~345-362) no lo tienen.
- Por eso responden **403 `MODO_SOPORTE`**, y el `catch` se lo traga.

Ese día Fabrizio estaba probando con «Ayudar a una tienda» (por eso vio también los errores A2 y 12), y el 9 era la campana de esa tienda.

**3 · Fuera del modo soporte, el número puede volver solo.**

`avisosNuevos` (`avisos.service.ts:321`) cuenta los avisos sin leer con `actualizadoEn > avisosVistosEn`. Pero `Aviso.actualizadoEn` es `@updatedAt`, así que **cualquier** `update` lo mueve, aunque no haya llegado nada:

- editar un mensaje (`mensajes.service.ts` ~1353);
- borrar un mensaje (~1412);
- pasar conversaciones a otra persona del Equipo (`equipo.service.ts` ~435).

Un aviso sin leer al que le pasa eso «vuelve a llegar» y el número sube otra vez. Además, la lista se ordena por `actualizadoEn`, así que ese aviso salta arriba.

**4 · El aviso que se toca puede cortar su propio `POST`.**

El `Link` de cada aviso (`features/avisos/lista-avisos.tsx:127-145`) marca y navega en el mismo clic. Con la navegación de Next el `fetch` suele seguir. Pero si el enlace hace una carga completa, o en el celular la pestaña se congela, el `POST` se puede perder. `keepalive: true` lo evita.

**Verificación rápida (10 segundos):** en producción, `pnpm --filter api prisma migrate status` debe mostrar aplicada `20261113140100_campanita_avisos_vistos`. Si faltara, `/contadores` daría 500 y el número quedaría en 0. No es lo que se ve, pero conviene descartarlo.

### Arreglo 1 · Modo soporte: mirar sin tocar los avisos de la tienda

**Decisión:** cuando el Equipo ayuda a una tienda, **no** debe marcar como vistos ni leídos los avisos de esa tienda. Si lo hiciera, la dueña perdería sus avisos sin haberlos visto. Así que en soporte la campana es «solo mirar».

**API.** Se deja como está: los dos `POST` siguen bloqueados en soporte. Agrega un comentario en el controlador para que nadie les ponga `@PermitirEnSoporte` sin pensarlo.

**Web.** Cabecera y campana:

- `RespuestaYo` ya trae `soporte` (lo usa `shared/ui/marco-pagina.tsx:31`). Pásalo desde `cabecera.tsx:439` a `<Campanita soporte={Boolean(sesion?.soporte)} />` y a `useContadores`.
- **En soporte:**
  - no se muestra el número naranja;
  - al abrir no se llama a `marcarAvisosVistos`;
  - al tocar un aviso se abre su enlace sin `marcarAvisoLeido`;
  - arriba de la ventanita, una línea gris: **«Estás viendo los avisos de {tienda}. Para ella siguen sin leer.»**
- **Página `/avisos`:** lo mismo (`features/avisos/pagina-avisos.tsx:38`). Sin `marcarAvisosVistos` y sin «Marcar todo como leído» en soporte.

```tsx
// shared/ui/campanita.tsx
export function Campanita({ sinLeer, sobreMarca = false, soporte = false }: { …; soporte?: boolean }) {
  …
  useEffect(() => {
    if (abierta && sinLeer > 0 && !soporte) marcarAvisosVistos();
  }, [abierta, sinLeer, soporte]);
  …
  onClick={() => {
    if (window.matchMedia('(max-width: 767px)').matches) router.push('/avisos');
    else {
      if (!abierta && !soporte) marcarAvisosVistos();
      setAbierta(!abierta);
    }
  }}
  …
  {!soporte && <Insignia cantidad={sinLeer} />}
```

`ListaAvisos` recibe `soloMirar` y, si está, su `onClick` solo hace `alAbrir?.()`.

### Arreglo 2 · Nunca fallar en silencio

Los dos marcadores siguen bajando el número al toque. Si la API dice que no, se vuelve a pedir la verdad y se avisa.

```ts
// shared/avisos-leidos.ts
const EVENTO_RECARGAR = 'paselibre:contadores-recargar';

function siFalla(error: unknown) {
  // La pantalla vuelve a lo que dice la base: nunca un 0 falso que reaparece con F5.
  // `detail` dice si hay que mostrar «No pudimos marcar el aviso» (no en soporte).
  const mostrar = !(error instanceof ErrorApi && error.codigo === 'MODO_SOPORTE');
  window.dispatchEvent(new CustomEvent(EVENTO_RECARGAR, { detail: { mostrar } }));
}

export function marcarAvisoLeido(aviso: AvisoCampanita): void {
  if (aviso.leido) return;
  window.dispatchEvent(new CustomEvent<AvisoCampanita>(EVENTO, { detail: aviso }));
  llamarApi('/avisos/leidos', { metodo: 'POST', cuerpo: { ids: [aviso.id] }, keepalive: true })
    .catch(siFalla);
}

export function marcarAvisosVistos(): void {
  window.dispatchEvent(new Event(EVENTO_VISTOS));
  llamarApi('/avisos/vistos', { metodo: 'POST', cuerpo: {}, keepalive: true }).catch(siFalla);
}

export function useRecargarContadores(recargar: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENTO_RECARGAR, recargar);
    return () => window.removeEventListener(EVENTO_RECARGAR, recargar);
  }, [recargar]);
}
```

- En `useContadores`: `useRecargarContadores(pedir);`.
- En `Campanita` y en `pagina-avisos.tsx`: `useRecargarContadores(cargar);`, para que vuelva el puntito real.
- Si `detail.mostrar`, la ventanita (y la página `/avisos`) muestra abajo, por 4 segundos, una línea roja chica: **«No pudimos marcar el aviso. Vuelve a intentarlo.»** La página no tiene un «toast» general, así que va dentro de la misma ventanita, con `aria-live="polite"`.

### Arreglo 3 · `keepalive` en `llamarApi`

`apps/web/src/shared/api/cliente.ts`: agrega `keepalive?: boolean` a las opciones y pásalo al `fetch`.

```ts
respuesta = await fetch(`/v1${ruta}`, {
  method: opciones.metodo ?? 'GET',
  credentials: 'same-origin',
  keepalive: opciones.keepalive ?? false,
  …
});
```

### Arreglo 4 · Columna `llegadoEn`: «llegó» deja de depender de `@updatedAt`

**Schema.** En `Aviso` (`schema.prisma:961-989`):

```prisma
  /// Cuándo llegó de verdad (se creó o trajo otro mensaje). No lo mueven ediciones ni borrados.
  llegadoEn      DateTime  @default(now()) @map("llegado_en") @db.Timestamptz(6)
  …
  @@index([usuarioId, llegadoEn])
```

**Migración** `2026111xxxxxxx_aviso_llegado_en`:

```sql
ALTER TABLE "aviso" ADD COLUMN "llegado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT now();
UPDATE "aviso" SET "llegado_en" = "actualizado_en";
CREATE INDEX "aviso_usuario_id_llegado_en_idx" ON "aviso" ("usuario_id", "llegado_en");
```

**Dónde se pone `llegadoEn: ahora`.** Solo donde llega algo nuevo:

- `avisos.service.ts:120-145`: el `upsert` del aviso de mensajes. En `contenido` agrega `llegadoEn: ahora`, porque llegó otro mensaje.
- `avisos.service.ts:220-232`: el `upsert` del chat con el Equipo. Junto a `actualizadoEn: ahora`, agrega `llegadoEn: ahora`.
- Los `createManyAndReturn` (`avisos.service.ts:169`, `en-vivo.service.ts:910`, `shared/aviso-seguridad.ts:26`) toman el `default now()`. No hay que tocarlos.
- Las ediciones, los borrados y el cambio de dueño (`mensajes.service.ts` ~1353 y ~1412, `equipo.service.ts` ~435) **no** ponen `llegadoEn`. Así no reviven el número.

**Contar y ordenar por `llegadoEn`.** `avisos.service.ts`:

```ts
// avisosNuevos (321)
...(vistos
  ? { OR: [{ llegadoEn: { gt: vistos } }, { visibleDesde: { gt: vistos } }] }
  : {}),

// lista (247)
orderBy: [{ llegadoEn: 'desc' }, { id: 'desc' }],
```

`visibleDesde > vistos` se queda. Es para «No molestar»: un aviso que se creó de noche «llega» cuando termina el horario.

### Pruebas automáticas

- **`avisos.service.spec.ts`:**
  - Editar un mensaje de un chat con aviso sin leer **no** sube `contadores().avisos` después de `vistos()`.
  - Un mensaje nuevo **sí** lo sube.
  - Un aviso con `visibleDesde` futuro cuenta recién cuando se hace visible.
- **`campanita.test.tsx`:** si `POST /avisos/vistos` responde 403, se vuelve a pedir `/contadores` y el número vuelve a lo que dice la API (no queda un 0 falso).
- **`campanita.test.tsx` en soporte:**
  - no hay insignia;
  - abrir la campana no hace ningún `POST`;
  - se ve «Estás viendo los avisos de…».
- **`sesion.guard.spec.ts`:** en soporte, `POST /avisos/vistos` sigue en 403. Es a propósito, para que nadie lo «arregle» abriéndolo.

### Prueba a mano (la que hará Fabrizio)

Con una tienda A, en su propia cuenta (**sin** soporte):

1. Otra tienda le escribe 3 mensajes en 3 chats → número 3.
2. Abrir la campana → 0.
3. F5 → sigue 0. Ir al Inicio, a Mensajes y a Mi perfil → sigue 0.
4. Abrir otra pestaña → 0. En el celular → 0.
5. Tocar un aviso → su puntito se apaga. Volver con F5 → sigue apagado; los otros 2 siguen con puntito.
6. La otra tienda **edita** un mensaje viejo → el número sigue en 0.
7. La otra tienda manda un mensaje **nuevo** → número 1.
8. «Marcar todo como leído» → ningún puntito, también después de F5.

En **modo soporte**, con Fabrizio ayudando a la tienda A:

9. No se ve número. Al abrir dice «Estás viendo los avisos de A…».
10. Tocar un aviso abre su enlace.
11. Al salir del soporte, la dueña entra con su cuenta y sus avisos siguen **igual que antes** (número y puntitos).

## A2. Publicar «a nombre de la tienda» en modo soporte da error

Error 13. Fabrizio entra con «Ayudar a una tienda» y, al publicar, sale «En modo soporte puedes acomodar la portada y los datos de la tienda, pero no chatear ni cerrar ventas».

**Causa:** `apps/api/src/modules/ofertas/ofertas.controller.ts` no tiene `@PermitirEnSoporte` en `POST ofertas` (68), `POST ofertas/confirmar` (88) ni `PATCH ofertas/:id` (123). La subida de fotos ya está permitida (`archivos.controller.ts:81`).

**Arreglo:**

```ts
@Post('ofertas')
@PermitirEnSoporte('publicó por tu tienda')
…
@Post('ofertas/confirmar')
@PermitirEnSoporte('publicó por tu tienda')
…
@Patch('ofertas/:id')
@PermitirEnSoporte('editó una de tus publicaciones')
```

- `DELETE ofertas/:id` y `ofertas/eliminar` siguen **cerrados** en soporte. Borrar no se pidió.
- Lo que se cambia queda anotado y se le avisa a la tienda con el mismo sistema de `ayuda.service.ts` («El equipo PaseLibre publicó por tu tienda»).
- El texto del error (`sesion.guard.ts:59`) pasa a: **«En modo soporte puedes acomodar el perfil y publicar por la tienda, pero no chatear ni cerrar ventas.»**
- **El cambio de «No disponible» del punto 16** usa el mismo `PATCH`, así que también queda permitido. Está bien: es acomodar la vitrina.

**Prueba:** Ayudar a una tienda → Publicar una RAM con foto → aparece en su perfil, y la tienda recibe el aviso.

## A3. Pedidos en vivo: la página no muestra la foto

Error 8. En la **página** «Pedidos en vivo» (`apps/web/src/features/en-vivo/pagina.tsx`, `Tarjeta`, línea 30) no hay foto. En la ventanita sí la hay (`features/en-vivo/piezas.tsx`, `FilaEnVivo` usa `<Miniatura ruta={item.foto} …/>`).

**Arreglo:** el diseño elegido es el **C**. Foto: `08_pedidos_en_vivo_con_foto`.

- Cada tarjeta lleva la **foto alta a la izquierda** (ancho fijo 120 px, todo el alto de la tarjeta, fondo blanco, `object-fit: contain`) y los datos a la derecha, como hoy.
- Qué foto va, en este orden:
  1. la del producto del catálogo (`item.foto`, la misma de `FilaEnVivo`);
  2. si no hay, la primera de `EnVivo.fotos` (las propias, de la 1.10.0);
  3. si tampoco, el ícono de su categoría sobre blanco.
- **La banda de Pedidos en vivo del Inicio no cambia:** sigue centrada al ancho de antes (1216). Fabrizio lo pidió así.

## A4. «Cómo llegar» y «Sobre la tienda» son opcionales

Error 9.

**`apps/web/src/features/configuracion/datos.tsx:172-180`.** «Perfil al N %» cuenta solo logo, portada y horario:

```ts
// «Perfil al N %»: logo, portada y horario. «Cómo llegar» y «Sobre la tienda» son opcionales (no cuentan).
const completos = [Boolean(logo), Boolean(tienda.portada), tramosConDias.length > 0 || (…)].filter(Boolean).length;
const porcentaje = Math.round((completos / 3) * 100);
```

- A los títulos de los dos campos opcionales súmales **«(opcional)»** en gris.
- **`apps/api/src/modules/catalogo/inicio.service.ts:384-398`.** «Completa tu perfil» deja de pedir la descripción:

  ```ts
  perfil: Boolean(tienda?.horario && tienda.portadaRuta),
  ```

  Saca `descripcion` del `select`, y corrige el comentario de la línea 384.
- Revisa el texto del paso en `features/inicio/piloto.tsx:106`: no debe nombrar «Sobre la tienda».

## A5. Al editar dice «¡Listo! Ya puedes publicar»

Error 17. En `apps/web/src/features/publicar/formulario-publicar.tsx:1293`, en modo edición (`?editar=`), el texto pasa a **«Listo para guardar»**. Al publicar, sigue como hoy.

## A6. Ficha del producto sin las burbujas de sinónimos

En `features/catalogo/ficha-producto.tsx:439-444` se dibujan `producto.etiquetas` como burbujas. **Se quitan de la vista.** Los sinónimos siguen sirviendo para buscar; solo no se muestran.

## A7. Importar catálogo: un sinónimo largo da error 500

- **La causa:** `Etiqueta.nombre` es `VarChar(60)` (`schema.prisma:540`). El importador parte la columna de sinónimos por `,` o `;` (`catalogo-equipo.service.ts:1081-1085`) y no mide el largo. Uno de más de 60 letras revienta el `upsert`.
- **El arreglo:** en esa misma lectura, si un sinónimo pasa de **40** letras (el mismo tope del formulario, `packages/contracts/src/soporte/panel.ts:327`), la fila lleva un error y **no** se importa. El resto del archivo sigue.

```ts
const largo = fila.sinonimos.find((s) => s.length > 40);
if (largo) anotarError(fila, { motivo: 'SINONIMO_LARGO', texto: `Un sinónimo pasa de 40 letras: «${largo.slice(0, 40)}…». Sepáralos con coma.` });
```

Suma `SINONIMO_LARGO` a `MotivoFila` y a `TEXTO_MOTIVO`.

## A8. RAM publicada antes de la 1.10.0: tomar Intel / EXPO del producto

Las ofertas de antes de la 1.10.0 tienen `perfil_memoria` en `null` y salen sin «Intel XMP» ni «AMD EXPO».

**Arreglo:** donde se arma la oferta (`apps/api/src/modules/catalogo/catalogo.service.ts:219`, y el mismo patrón en `ofertas.service.ts` y `tiendas.service.ts`), usa el del producto si la oferta no tiene:

```ts
perfil_memoria: o.perfilMemoria ?? producto.perfilMemoria,
```

No se guarda nada nuevo en la base.

**Al publicar ya se marca solo:** `formulario-publicar.tsx:398` toma el perfil del producto. Si una RAM sale sin marcar, es porque **al producto le falta el dato**, no por el código.

**Al editar** (`formulario-publicar.tsx:446`) hay que sumar el mismo respaldo, para que una RAM vieja no aparezca sin marcar:

```ts
perfil_memoria: oferta.detalle.perfil_memoria ?? producto?.perfil_memoria ?? null,
```

**Dato que trae Fabrizio:** el perfil (Intel / EXPO) de cada RAM del catálogo, en la columna «Perfil de memoria» del Excel de importación.

## A9. Panel › Catálogo, «muy parecido»: la palabra que cambia, en negrita

En el aviso de duplicado al crear un producto (`features/equipo/catalogo.tsx:617`, «mismo código» / «muy parecido»), los dos nombres se ven casi iguales. Por ejemplo: «Corsair Vengeance 32GB DDR5 6000 **CL30**» y «… **CL28**».

**Arreglo:** compara palabra por palabra (con `normalizarTexto`) y pon en **negrita** las que están en uno y no en el otro, en los dos nombres.

---

# B · Novedades

## Lo que se ve en todas las tarjetas

### 3. Fondo blanco en fotos y tarjetas

Fotos: `03a_fotos_horizontal`, `03b_que_categorias_van_horizontal`, `18_linea_entre_foto_y_nombre`.

- `packages/ui/src/index.ts:45`: `'foto-fondo': '#F1F4F2'` pasa a **`'#FFFFFF'`**. Es el fondo de la foto en **todas** las tarjetas de publicación, la ficha, Mis publicaciones, la vista previa al publicar y el chat.
- **El fondo de la página sigue gris.** Solo cambian las fotos y las tarjetas.
- Busca `mix-blend-multiply` sobre las fotos: sobre blanco ya no hace falta y puede quitarse, aunque no molesta.

**Las fotos nuevas son un dato, no código.** Fabrizio las sube con el importador del catálogo:

- **Horizontales** (marca y modelo arriba, 3 cajas de datos en fila, el producto grande al centro y las pastillas abajo): Memoria RAM, Teclados, Mouse pads, Fuentes, Refrigeración líquida, Monitores y Procesadores.
- **En columna**, como hoy: Tarjetas de video, Placas madre, Cases, Mouse, Audífonos y Almacenamiento.
- **Pastillas de perfil de las RAM:** AMD EXPO naranja `#E8590C` e INTEL XMP azul `#1D5FD1`.

### 18. Línea gris entre la foto y el nombre

Foto: `18_linea_entre_foto_y_nombre` (elegida la **línea 1**).

- Con el fondo blanco, el nombre parecía pegado a la foto. Debajo de la foto va una **línea gris clara de 1 px, de borde a borde** de la tarjeta (`border-top: 1px solid #DDE4E0` en el bloque de texto, con margen negativo para tocar los bordes).
- Va en `shared/ui/tarjeta-producto.tsx` y en `features/inicio/tarjetas.tsx`, o en la que quede como única después del punto 22.
- **Al pasar el cursor la línea sigue gris.** No cambia de color.

### 19. Al pasar el cursor

Foto: `19_y_22_hover_y_chapita`. Tablero P60, con animación.

Elegida la **L sin la línea verde**. Al pasar el cursor por una tarjeta:

1. **la tarjeta entera se pinta menta `#F4FBF7`**, pero **la foto sigue blanca**;
2. **aparece la flechita «›»** verde al lado del nombre (entra deslizándose 4 px);
3. **la chapita sube** (punto 22).

Usa `transition: background-color .18s, transform .18s`. Con `prefers-reduced-motion`, sin deslizamiento: solo el color.

### 21. La burbuja del precio no cambia

Foto: `21_burbuja_y_busqueda_5060`.

- **Se queda como está en el código:**
  - la pastilla verde `#00875A` con «Pase»;
  - «Negociable» en amarillo;
  - la de socio;
  - «Por chat»;
  - `US$`;
  - céntimos solo si hay.
- «Más barato» sigue **naranja**.
- **Revisa que la búsqueda muestre una tarjeta por producto**, con la tienda más barata y debajo «N tiendas más lo tienen». En el tablero lo dibujé según el código de la 1.10.0. Si ya es así, aquí no hay nada que hacer.

## Inicio

### 4. Página más ancha, 5 por fila, 4 filas y paginación

Foto: `04_y_22_inicio_5_por_fila_sin_titulos`. Tablero P54.

Elegida la **C**.

- **El contenido del Inicio pasa a 1440 px de ancho** (hoy 1216; ver `shared/ui/carrusel-medidas.test.ts`).
- **La foto ocupa la tarjeta de borde a borde**, sin margen interno arriba ni a los lados.
- **5 tarjetas por fila y 4 filas: 20 por página.** Abajo: `‹ 1 2 3 … 7 Siguiente ›` y el botón **«Ver todas las publicaciones»**, que lleva a la búsqueda sin filtro ordenada por recientes.
- **Se acaban las filas con flecha (carrusel).** `inicio-tienda.tsx:184` hoy dice «4 filas de hasta 18, cada una con su flecha»: eso se reemplaza por la grilla.
- **La banda «Pedidos en vivo» queda centrada al ancho de antes (1216).** Fabrizio quiere que se vea «centradita» como ahora.
- **En celular:** 2 por fila, 10 por página, con la misma paginación.
- **API:**
  - `inicio.service.ts`: `RECIEN_INICIO = 20` y `RECIEN_POR_PAGINA = 20`;
  - `GET /inicio/recien?pagina=N` en vez de `desde`;
  - devuelve `total_paginas`.

### 22. Inicio sin títulos y la chapita al pasar el cursor

Fotos: `04_y_22_inicio_5_por_fila_sin_titulos`, `19_y_22_hover_y_chapita`, `22b_chapitas`. Tableros P54, P58 y P60.

- **Después de Pedidos en vivo va una sola grilla, sin títulos de sección.** Se quitan los títulos «Recién publicado», «Remates de hoy», «Lo más buscado», etc. El orden lo decide el punto 4b. Lo que antes eran secciones ahora son **chapitas** en cada tarjeta.
- **La chapita** (diseño **C**):
  - va arriba a la derecha de la foto (los datos de la foto van a la izquierda);
  - es blanca, con sombra suave (`0 4px 14px rgba(15,20,18,.14)`), ícono y texto de color, 12 px en negrita;
  - **aparece solo al pasar el cursor**, subiendo 6 px con un fundido;
  - en el celular se ve siempre, más chica.
- **Las 4 chapitas** (una por tarjeta, en este orden de prioridad):

  | Chapita | Cuándo | Color |
  |---|---|---|
  | **Recién publicado** | `creadaEn` hace **20 minutos o menos** | verde `#00875A` |
  | **Más barato de la galería** | Su precio de pase es el más bajo de las ofertas vigentes de ese producto en su galería (al menos 2 ofertas) | naranja (el de «Más barato») |
  | **Muy buscado hoy** | El producto está en el top 10 de hoy (ver 4b) | morado `#6D3FD1` |
  | **Bajó de precio** | `precioBajoEn` en las últimas 48 h (`precioAnteriorCentimos` ya existe). Texto: «Bajó S/ 40» | azul `#1D5FD1` |

- La API manda `chapita: 'RECIEN' | 'MAS_BARATO' | 'MUY_BUSCADO' | 'BAJO' | null` y `bajo_centimos` en cada tarjeta del inicio.

### 4b. Orden por puntos, tope por tienda y «Destacar» con fuerza

Fotos: `04b_orden_por_puntos`, `04c_tope_por_tienda`, `04d_destacar_con_fuerza`. Tableros P50, P62 y P65.

Hoy `pagina()` (`inicio.service.ts:164-215`) ordena por `actualizadaEn`, mezcla para que no salgan dos seguidas de la misma tienda (`mezclarSinRepetir`) y mete las destacadas en los lugares 0, 2, 1 y 3 (`shared/destacados.ts`, `mezclarDestacadas`). Se reemplaza por **puntos**.

**Los puntos de cada publicación vigente.** Todo en un archivo nuevo, `apps/api/src/modules/catalogo/puntos-inicio.ts`, con constantes fáciles de ajustar:

| Suma o resta | Cuánto |
|---|---|
| **Novedad** (por `creadaEn`) | 20 min o menos: **+40** · hasta 6 h: **+25** · hasta 24 h: **+15** · hasta 3 días: **+5** |
| **Más barato de la galería** | **+15** |
| **Muy buscado hoy** | **+10** |
| **Bajó de precio** (48 h) | **+8** |
| **Reseñas de la tienda** | de **0 a +10**, con su puntaje Wilson (`wilson.service.ts` / `reputacion-corta.ts`) |
| **Responde rápido** | **+5** si la tienda responde en menos de 15 min (si el dato ya existe; si no, se deja para después) |
| **Día de la fundadora** (punto 7) | **+25**, todo ese día (hora de Lima) |
| **«Destacar» del Equipo** | Suave **+20** · Media **+40** · Fuerte **+70**, mientras dure |
| **Reportes** | **−15** por cada reporte abierto de esa publicación |
| **Vieja** | **−10** si no se actualizó en 14 días |

- **Empates:** `creadaEn` desc, después `id`.
- **«Muy buscado hoy»:** son los 10 productos con más puntos hoy, sumando las `VistaOferta` de hoy de todas sus ofertas más 3 por cada pedido en vivo de hoy de ese producto. Mínimo 3 para entrar.
- **Cómo calcularlo:**
  - toma las vigentes de los últimos 30 días (o las 600 más nuevas, lo que sea menos), calcula los puntos en memoria y guarda el orden **60 s en caché, igual para todos**;
  - por cada tienda que mira, saca sus bloqueadas y las suyas propias;
  - el orden ya no depende de la página: la página 3 sigue donde terminó la 2.

**Tope por tienda en cada fila** (5 tarjetas por fila):

| Tiendas con publicaciones vigentes | Máximo de la misma tienda por fila |
|---|---|
| 4 o menos | **3** |
| de 5 a 14 | **2** (hoy, con 7 tiendas, es este) |
| 15 o más | **1** |

- Se llena fila por fila con el orden de puntos. Si la siguiente pasa el tope de su tienda en esa fila, se salta y queda primera para la fila siguiente.
- Nunca quedan huecos: si ya no hay de otras tiendas, se completa con lo que queda.
- `mezclarSinRepetir` se puede seguir usando **dentro** de la fila, para que no queden dos de la misma tienda una al lado de la otra.

**«Destacar» con fuerza** (Panel del Equipo, solo cuentas del Equipo; `features/equipo/destacar.tsx`):

- La ventana suma **«¿Con qué fuerza?»**: Suave / Media / Fuerte (Media marcada por defecto). Cada opción lleva su mapita de la grilla del Inicio con los lugares donde suele caer:
  - **Suave:** «Sube un poco y queda repartida.»
  - **Media:** «Sale en las primeras filas.»
  - **Fuerte:** «Casi seguro en la primera fila.»
- Las duraciones no cambian: 1 hora, 3 horas o todo el día.
- **Schema:** `Destacado.fuerza` con un enum `FuerzaDestacado { SUAVE MEDIA FUERTE }` y `@default(MEDIA)`. Las de hoy quedan como `MEDIA`.
- **Ya no hay lugares fijos:** se quita `mezclarDestacadas` del inicio. Destacar solo **suma puntos**, así que nunca salen todas juntas y no se nota.
- El texto «Mezcladas entre los 4 primeros lugares del inicio» pasa a «Suben en el Inicio según la fuerza; nunca salen todas juntas». «Más arriba en las búsquedas de su categoría» se queda.

### 7. «Piloto» pasa a «Tiendas fundadoras» (solo 10)

Fotos: `07_tiendas_fundadoras`, `07b_fundadoras_inicio`. Tableros P53 y P55.

**La palabra «piloto» desaparece de todo lo que se ve:**

| Dónde | Hoy | Queda |
|---|---|---|
| Inicio, tarjeta verde (`features/inicio/piloto.tsx:50,54`) | «Piloto en la galería…» | **«★ Tiendas fundadoras · 7 de 10 ya entraron»** con barra **dorada** |
| Registro (`features/registro/formulario-registro.tsx:412`) | «Gratis durante el piloto…» | **«Gratis para las tiendas fundadoras.»** |
| Panel (`app/equipo/cuentas/page.tsx:5`, `features/equipo/panel-cuentas.tsx:136`) | «Cuentas del piloto» | **«Cuentas de tiendas»** |

- En el código puede seguir llamándose `piloto.tsx`. Solo cambia lo que se ve.
- Busca «piloto» en `apps/web/src` y en los textos de la API por si queda alguno.

**Panel del Equipo › Tiendas › Fundadoras** (pestaña nueva, junto a «Todas»):

- La lista muestra «★ Fundadoras · 7 de 10».
- Botón **«+ Agregar fundadora»**. Máximo 10: con 10, el botón se apaga y dice «Ya están las 10».
- Cada fila:
  - tienda y stand;
  - **su día destacado** (Lun a Sáb, uno solo);
  - interruptor **«Sello en su perfil»**;
  - interruptor **«Prioridad en el chat»**;
  - «Quitar».
- Abajo: «Su día destacado: ese día sus publicaciones van primero en el Inicio y en las búsquedas, **sin borde ni marca** (las demás tiendas no lo notan). Quedan N lugares.»

**Schema** (en `Tienda`):

```prisma
fundadoraDesde      DateTime? @map("fundadora_desde") @db.Timestamptz(6)  // null = no es fundadora
fundadoraDia        Int?      @map("fundadora_dia")        // 1 = lunes … 6 = sábado
fundadoraSello      Boolean   @default(true) @map("fundadora_sello")
fundadoraPrioridad  Boolean   @default(true) @map("fundadora_prioridad")
```

El tope de 10 se valida en la API (`count where fundadoraDesde not null`), dentro de una transacción.

**Lo que gana cada fundadora:**

1. **Día destacado:** +25 puntos en el Inicio (4b) y más arriba en las búsquedas, ese día. **No se ve** en el feed.
2. **Sello dorado «★ Fundadora»**, **solo en su perfil** (no en las tarjetas del feed). Debajo del nombre: «Tienda fundadora desde nov. 2026».
3. **Prioridad en el chat con el Equipo:**
   - en la lista de mensajes de la tienda, el chat del Equipo queda **fijo arriba** con «★ Prioridad fundadora»;
   - dentro del chat, arriba: «Respondemos primero · menos de 1 h»;
   - en el panel del Equipo, sus chats salen primero en «Chats».
4. **Gratis.** Ya lo es hoy; queda dicho en el registro.

**API pública del Inicio:** la tarjeta verde pide `fundadoras: { entraron: 7, total: 10, iniciales: ['DA', 'TW', …] }`.

## Tiendas y publicaciones

### 5. Perfil Público, Privado u Oculto, y «Cómo me ven»

Foto: `05_perfil_publico_privado_oculto`. Tablero P63 (y P55, parte 3).

**El selector.** En el perfil propio, al lado de «Editar perfil»: **«Perfil: Público ▾»** y el botón **«Cómo me ven»**.

- «Cómo me ven» desapareció en la 1.10.0 y Fabrizio lo quiere de vuelta. Abre el perfil tal como lo ve otra tienda.
- El menú del selector tiene el título «¿QUIÉN VE TU PERFIL?» y tres opciones:

| Opción | Qué pasa |
|---|---|
| **Público** | Todas las tiendas lo encuentran y ven sus publicaciones en el Inicio y el buscador (como hoy). |
| **Privado** | Lo encuentran **solo con su nombre exacto**. Ven el nombre; **logo y portada borrosos**. Para ver sus publicaciones, stand y datos tienen que **pedir seguirla** y la dueña acepta. **Sus publicaciones solo salen a sus seguidores** (Inicio, búsquedas, ficha del producto, pedidos en vivo). |
| **Oculto** | No aparece a nadie: ni en el buscador, ni en el Inicio, ni con su nombre exacto. Sus publicaciones tampoco. |

**Schema.** `Tienda.perfilPrivado Boolean` (`schema.prisma:278`, hoy marcado «Fase 2») se reemplaza:

```prisma
enum VisibilidadPerfil { PUBLICO PRIVADO OCULTO }
visibilidad  VisibilidadPerfil @default(PUBLICO)
```

Migración: `PRIVADO` donde `perfil_privado = true`, y después borra la columna.

```prisma
model SolicitudSeguir {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tiendaId  String   @map("tienda_id") @db.Uuid     // la que pide
  seguidaId String   @map("seguida_id") @db.Uuid    // la privada
  usuarioId String   @map("usuario_id") @db.Uuid
  creadaEn  DateTime @default(now()) @map("creada_en") @db.Timestamptz(6)
  @@unique([tiendaId, seguidaId])
  @@map("solicitud_seguir")
}
```

**Cómo funciona:**

- **Perfil privado visto por otra tienda:**
  - nombre visible;
  - logo y portada con `filter: blur(14px)`, y la API manda **versiones chicas** (no la original, para que no se pueda «desenfocar»);
  - el texto «Esta cuenta es privada. Pide seguirla para ver sus publicaciones, su stand y sus datos. La tienda decide si te acepta.»;
  - el botón **«Solicitar seguir»**, que después dice «Solicitud enviada» y se puede cancelar.
- **La solicitud llega a la campana** como aviso nuevo `TipoAviso.SOLICITUD_SEGUIR`: «{Tienda} quiere seguir tu tienda», con **Aceptar** / **Rechazar**.
  - Aceptar crea el `Seguimiento` y borra la solicitud.
  - Rechazar la borra sin avisar a la otra tienda.
- **Al pasar a Privado, los que ya la seguían se quedan.** En «Tus seguidores (48)» puede **quitar** a cualquiera (borra el `Seguimiento`).
- **Búsqueda de tiendas** (`directorio.service.ts:227`):
  - `PRIVADO` solo sale si el texto normalizado es **igual** al nombre normalizado, y se ve como «Tienda · Cuenta privada»;
  - `OCULTO` no sale nunca.
- **Publicaciones** (Inicio, búsqueda, ficha, «Las tiendas que lo tienen», pedidos en vivo):
  - las de una tienda `PRIVADO` solo las ve una tienda que la sigue;
  - las de una `OCULTO`, nadie.
  - Ponlo en **un solo lugar**, junto a las bloqueadas (`tiendasBloqueadasPor`). Por ejemplo, `tiendasQueNoVeo(prisma, tiendaId)` devuelve bloqueadas + ocultas + privadas que no sigo, y todas las consultas usan eso.
- **El Equipo** ve todo, siempre.
- **Mensajes:** los chats que ya existen siguen. Una tienda que no la sigue no puede abrir un chat nuevo desde el perfil privado (el botón «Escribir» no aparece).

### 8. Página Pedidos en vivo con foto

Ver A3: es el mismo arreglo.

### 11. Un solo buscador para todo

Foto: `11_buscadores`. Tablero P46.

**El problema.** Hay 6 buscadores y no todos entienden lo mismo. «ram» no encontraba nada en **Publicar** y **Pedir en vivo** porque esos no usan `interpretarBusqueda`.

**El arreglo: un solo motor.** Usa `packages/contracts/src/catalogo/interpretar.ts` + la búsqueda de `busqueda.service.ts` (`palabras` 460, `condicionesTexto` 490, `corregir` 929) en:

- la barra de arriba (ya lo usa);
- **Publicar** y «Publicar uno igual» (`ofertas.service.ts`, `idsQueCoinciden` 277);
- **Pedir en vivo** (`en-vivo.service.ts`, `coincidencia` ~818, que hoy tiene su propia lista `VACIAS`);
- **Mis publicaciones** (`ofertas.service.ts` 675). Suma el corrector de letras cambiadas;
- **Panel › Catálogo** (`catalogo-equipo.service.ts` 424 y 553). Mantiene además lo de «muy parecido».

**Lo que tiene que entender** (todo en `interpretar.ts`):

1. **Más palabras de categoría** en `CATEGORIA_DE`:

   ```ts
   case: 'cases', cases: 'cases', gabinete: 'cases', gabinetes: 'cases', chasis: 'cases', torre: 'cases',
   ssd: 'almacenamiento', nvme: 'almacenamiento', hdd: 'almacenamiento', m2: 'almacenamiento',
   sata: 'almacenamiento', 'disco duro': 'almacenamiento',
   pad: 'mouse-pads', mousepad: 'mouse-pads', 'mouse pad': 'mouse-pads', alfombrilla: 'mouse-pads',
   cooler: 'refrigeracion', disipador: 'refrigeracion', liquida: 'refrigeracion', aio: 'refrigeracion',
   enfriamiento: 'refrigeracion', refrigeracion: 'refrigeracion',
   mouse: 'mouse', mause: 'mouse', audio: 'audio', headset: 'audio', diadema: 'audio',
   ```

   - «m.2» llega como `m 2` después de `normalizarTexto`: júntalo a `m2` antes de buscar.
   - Las de **dos palabras** («mouse pad», «disco duro») se miran **antes** que las de una.
2. **Categoría + marca + tipo.** Si nombras la categoría, la marca y el tipo filtran **dentro** de ella:
   - «ram gskill» → Memoria RAM de G.Skill;
   - «almacenamiento kingston»;
   - «m.2 1tb» → Almacenamiento M.2 de 1 TB;
   - «sata 480».
   - `ssd`, `nvme`, `m2`, `sata`, `hdd`, `ddr4` y `ddr5` sirven **a la vez** para elegir la categoría **y** como tipo que se busca en el nombre, los sinónimos o las características.
3. **Alias de marca** (en `SINONIMOS`, para cualquier búsqueda):

   ```ts
   gskill: 'g skill', 'g.skill': 'g skill', wd: 'western digital', westerndigital: 'western digital',
   tforce: 'teamgroup', team: 'teamgroup', hyperx: 'hyperx', coolermaster: 'cooler master',
   cm: 'cooler master', tplink: 'tp link', adata: 'adata', xpg: 'xpg',
   ```

   Además, `normalizarTexto` del lado del catálogo ya convierte «G.Skill» en «g skill».
4. **Palabras de relleno** (más allá de `RELLENO`), que se ignoran siempre: `de, para, con, el, la, los, las, un, una, y, o, en, nuevo, nueva, original, sellado, gamer, gaming, pc, color`. Sirve para pegar un nombre largo del Excel.
5. **«Lo más parecido».** Si no hay nada con **todas** las palabras, se busca con las que sí están. Salen los productos que tienen **al menos el 60 %** de las palabras, ordenados por cuántas tienen. El título dice **«No hay uno igual. Lo más parecido:»**. Con esto, pegar el nombre entero de un producto lo encuentra aunque tenga palabras de más.
6. **EXPO y XMP se pueden buscar:**
   - «expo» busca las RAM con `perfil_memoria` EXPO (de la oferta o del producto, ver A8);
   - «xmp» o «intel», las XMP.
7. **«ram», «memoria» y «procesador» funcionan en todos los buscadores.** Fue la queja que empezó esto.

**Pruebas** (`interpretar.spec.ts`, una por fila del tablero P46):

| Escribe | Debe dar |
|---|---|
| `ram gskill` | RAM · G.Skill |
| `almacenamiento kingston` | Almacenamiento · Kingston |
| `m.2 1tb` | Almacenamiento · M.2 · 1 TB |
| `sata 480` | Almacenamiento · SATA · 480 GB |
| `case deepcool` | Cases · DeepCool |
| `mouse pad` | Mouse pads |
| `cooler` | Refrigeración |
| `ram expo` | RAM con EXPO |
| `5600xt` | «5600 xt» (ya funciona, que no se rompa) |
| nombre largo pegado del Excel | el producto, en «Lo más parecido» si sobra alguna palabra |

### 14. Botón «Editar» en cada publicación

Fotos: `14a_boton_editar`, `14b_pantalla_editar`, `14c_vista_previa_blanca`. Tableros P30, P35 y P37.

- En **Mis publicaciones** (`features/mis-publicaciones/panel-publicaciones.tsx`), cada fila lleva el botón **«Editar»** (con lápiz), **al lado del control de disponibilidad** (punto 16).
- Hoy el enlace a `/publicar?editar=${oferta.id}` solo aparece cuando la publicación no tiene precio (línea ~260). **Va siempre.**
- **Al pasar el cursor por la fila, se ilumina en verde suave**, igual que las filas del panel (la del doc 19 §5).
- **La pantalla de editar ya existe** (`app/(vendedor)/publicar/page.tsx` con `?editar=`). Es la misma de publicar, con todo cargado. Solo cambian:
  - el texto del A5;
  - la vista previa de la derecha, **con fondo blanco** (punto 3).

### 16. «Pausar» pasa a «No disponible ▾»

Foto: `16_no_disponible`. Tablero P34, opción **C**.

- **Un solo botón:** **«No disponible ▾»**, con el ojo tachado. Al tocarlo se abre un menú con el título «¿POR QUÉ NO ESTÁ DISPONIBLE?»:

| Opción | Qué hace |
|---|---|
| **Se me acabó** | Pone el stock en 0. Queda en «Sin stock» y vuelve sola cuando sube la cantidad. |
| **La separé para un cliente** | Se oculta. En el chat, junto al producto, dice **«Separada»**. |
| **Otro motivo** | Se oculta hasta que la vuelva a mostrar. |

- Abajo del menú: «Mientras no esté disponible, no sale en búsquedas ni en el feed».
- La pestaña «Pausadas» pasa a **«No disponibles»** (junta las sin stock y las pausadas). «Reactivar» pasa a **«Volver a mostrar»**.
- **Código:**
  - `RAZONES_PAUSA` (`packages/contracts/src/ofertas/ofertas.schemas.ts:267`) pasa a `['Se me acabó', 'La separé para un cliente', 'Otro motivo']`. «Se me acabó» ya **no pausa**: pone `stock = 0`. Las dos otras pausan como hoy (`estado: 'PAUSADA'`, con su razón). Las pausadas de hoy con «Se me acabó, espero mercadería» se leen igual que «Se me acabó»;
  - en `misOfertasSchema`, el estado `pausadas` pasa a `no_disponibles` (sin stock + pausadas);
  - deja `pausadas` como alias un tiempo, por los enlaces guardados.
- En el chat, el texto «Pausada» pasa a «Separada» o «No disponible», según el motivo.
- En «Eliminar varias», el consejo «Si solo no tienes stock, mejor Pausar» pasa a «… mejor «No disponible»».
- **No se toca** el «Pausar» de la ventanita de Pedidos en vivo: ese detiene el carrusel y es otra cosa.

### 20. Perfil de tienda: lo nuevo, sus mejores precios y todo

Foto: `20_perfil_de_tienda`. Tablero P47, opción **C**.

En `features/tiendas/perfil-tienda.tsx`, la pestaña Productos se arma en tres secciones:

1. **«Lo nuevo de esta semana»:** lo que publicó en los últimos 7 días, lo más nuevo primero, en una fila. Si no hay nada, la sección no aparece.
2. **«Sus mejores precios»:** sus publicaciones donde es la más barata de la galería, con la chapita **«Más barato de la galería»** (la misma regla del punto 22). Si no hay, no aparece.
3. **«Todo»:**
   - burbujas con **solo las categorías que esa tienda vende** y cuántas tiene: «Todo · 16», «Memoria RAM · 6», «Teclados · 4»…;
   - a la derecha, **«Ordenar ▾»**: Recién publicados (por defecto), Precio: menor a mayor, Precio: mayor a menor, Más vistos y Remates primero;
   - con varias categorías marcadas a la vez, se suman.

**API:** `GET /tiendas/:slug/publicaciones?categoria=ram,teclados&orden=precio_asc` y, aparte, `nuevas` y `mejores_precios` en la respuesta del perfil.

### 23. Ficha del producto

Fotos: `23a_ficha_del_producto`, `23b_ficha_miniaturas`. Tableros P61 y P64.

- **La foto grande, en blanco**, del ancho que le toca. Las horizontales (teclados, RAM…) se ven enteras, sin recorte (`object-fit: contain`).
- **Sin las burbujas de sinónimos** (A6).
- **Miniaturas debajo de la foto grande:**
  - **la primera es la portada que eligió la tienda al publicar** (no siempre la del catálogo);
  - después, la del catálogo (si no es la portada) y las demás fotos de la tienda;
  - flechas **‹ ›** a los lados de la foto grande y el contador «1 / 4»;
  - la miniatura activa lleva borde verde;
  - en el celular, deslizar con el dedo y puntitos en vez de miniaturas.

## Panel del Equipo

### 6. Menú del panel en dos pisos (también arregla el 12)

Foto: `06_menu_del_panel_dos_pisos`. Tablero P56, opción **A**.

- En `apps/web/src/features/equipo/secciones.tsx`:
  - **arriba**: el logo, la versión y la cuenta;
  - **abajo**, en una fila propia de todo el ancho: todas las pestañas (Inicio, Solicitudes, Reportes, Tiendas, Galerías, Chats, Comunicados, Cuentas y Catálogo).
- Así **«Catálogo» deja de cortarse** (error 12). El commit `2af38c2` lo achicó para que entre a 1440, pero en pantallas más chicas se sigue cortando.
- **En pantallas angostas,** la fila de pestañas se desliza de costado (`overflow-x: auto`) y nunca se corta a la mitad.

---

## Versión 1.11.0 en `packages/contracts/src/version.ts`

`VERSION = '1.11.0'` y, arriba de `NOVEDADES`:

```ts
{
  version: '1.11.0',
  fecha: 'AAAA-MM-DD',
  publico: [
    'Fotos más grandes y en blanco.',
    'El buscador ahora entiende «ram kingston», «m.2 1tb», «case» y más.',
    'Edita tus publicaciones con un toque.',
    'Elige quién ve tu perfil: público, privado u oculto.',
    'Marca una publicación como «No disponible» y di por qué.',
  ],
  equipo: {
    nuevo: [
      'Tiendas fundadoras (máximo 10): día destacado, sello en su perfil y prioridad en el chat.',
      '«Destacar» con fuerza: suave, media o fuerte.',
      'Perfil público, privado u oculto, con solicitudes para seguir en la campanita.',
      'Botón «Editar» en cada publicación.',
      'En modo soporte se puede publicar y editar por la tienda.',
    ],
    cambia: [
      'Inicio: 5 por fila, 4 filas, paginación y sin títulos; el orden es por puntos y con tope por tienda.',
      'Chapitas al pasar el cursor: Recién publicado, Más barato de la galería, Muy buscado hoy y Bajó de precio.',
      'Fondo blanco en fotos y tarjetas, con una línea entre la foto y el nombre.',
      'Un solo buscador en todo el sitio (arriba, Publicar, Pedir en vivo, Mis publicaciones y Catálogo).',
      '«Pausar» pasa a «No disponible» con su motivo.',
      'Perfil de tienda: Lo nuevo de esta semana, Sus mejores precios y Todo, con filtros.',
      'Ficha del producto con miniaturas; la primera es la portada de la tienda.',
      'Pedidos en vivo con foto.',
      'Menú del panel en dos pisos.',
      '«Piloto» pasa a «Tiendas fundadoras».',
      '«Cómo llegar» y «Sobre la tienda» son opcionales.',
    ],
    arregla: [
      'Campanita: el número ya no vuelve con F5 y tocar un aviso lo apaga.',
      'Publicar en modo soporte daba error.',
      '«Catálogo» se cortaba en el menú del panel.',
      'Importar un sinónimo largo daba error 500.',
      'La RAM publicada antes de la 1.10.0 ahora muestra Intel / EXPO.',
      'Al editar decía «¡Listo! Ya puedes publicar».',
    ],
    datos: [
      'Fotos horizontales para RAM, teclados, mouse pads, fuentes, refrigeración líquida, monitores y procesadores.',
      'Intel / EXPO de cada RAM del catálogo.',
    ],
  },
},
```

---

## Checklist final antes de subir la 1.11.0

- [ ] **Campanita (A1):** pasan las 11 pruebas a mano de A1, en la computadora y en el celular, con una cuenta normal **y** en modo soporte.
- [ ] **Migraciones nuevas, probadas en staging y con un respaldo antes de producción:**
  - `aviso.llegado_en` (con su relleno desde `actualizado_en`);
  - `Destacado.fuerza`;
  - los 4 campos de fundadora en `Tienda`;
  - `Tienda.visibilidad` (reemplaza `perfil_privado`);
  - `solicitud_seguir`;
  - `TipoAviso.SOLICITUD_SEGUIR`.
- [ ] `prisma migrate status` en producción muestra todo aplicado, también la `20261113140100_campanita_avisos_vistos` de la 1.10.0.
- [ ] Pasa la prueba que revisa que `VERSION` es la primera de `NOVEDADES`.
- [ ] **«piloto»:** no aparece en ningún texto que se vea (`grep -ri piloto apps/web/src`, salvo nombres de archivos y variables).
- [ ] **Perfil privado y oculto:** con dos tiendas de prueba, revisado en el Inicio, la búsqueda, la ficha, «Las tiendas que lo tienen», Pedidos en vivo y el directorio de tiendas.
- [ ] **Buscador:** pasan las 10 filas de la tabla del punto 11 en los 5 buscadores.
- [ ] **Inicio:** con la base de hoy (Dark Alien con 14 publicaciones y 6 tiendas más), ninguna fila tiene más de 2 de Dark Alien, y la página 2 sigue donde terminó la 1.
- [ ] **Animaciones** (19 y 22): revisadas con `prefers-reduced-motion`.
- [ ] Revisado en la computadora (1440 y 1280 de ancho) y en el celular.

## Pendiente de Fabrizio (no bloquea)

- La foto del **Ajazz AK820 Max** (lo saqué del paquete de la tienda 2A-126 hasta tenerla).
- Las fotos de los **135 productos** del catálogo que todavía no tienen.
- **Intel / EXPO** de cada RAM del catálogo, en la columna «Perfil de memoria» (A8 la usa).
- Subir con el importador las **fotos horizontales** nuevas (punto 3).

## Qué quedó fuera (para que no se haga)

- **No hay títulos de sección en el Inicio** («Recién publicado», «Remates de hoy»…). Lo dicen las chapitas.
- **El día destacado de las fundadoras no se ve en el feed:** sin borde dorado ni marca.
- **El sello «★ Fundadora» no va en las tarjetas del feed,** solo en su perfil.
- **Sin línea verde que avanza** al pasar el cursor (se probó y no va).
- **La chapita va arriba a la derecha.** No abajo.
- **No se muestran las burbujas de sinónimos** en la ficha.
- **No cambia la burbuja del precio** ni el naranja de «Más barato».
- **«Destacar» no tiene lugares fijos:** solo suma puntos.
- **El «Pausar» de la ventanita de Pedidos en vivo no se toca.**
- **En modo soporte no se marcan los avisos de la tienda** (A1) y **no se borra** (A2).
