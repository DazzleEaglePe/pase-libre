# 13 · Modo claro y oscuro

**Fecha:** sábado 07/11/2026 · **Estado:** planeado, sin código · **Sprint propuesto:** lun 09/11 → vie 13/11 (5 días)

Poder cambiar la web entre **Claro**, **Oscuro** y **Sistema** (sigue el celular o la computadora), desde cualquier pantalla, y que se recuerde. Este documento trae lo que hay que decidir, cómo está la web hoy, la paleta oscura con su contraste medido, el sprint día por día y los checklists para ir marcando.

> **Actualización 08/11:** este plan se escribió con la web en Hielo (azul). Desde el 08/11 la línea es verde esmeralda (D-54), así que la paleta oscura «Noche» de §4 hay que rehacerla sobre el verde antes del día 1; la estructura del sprint, los roles de color y los checklists siguen valiendo.

> Entendí «blanco y negro» como modo claro/oscuro. Si la idea era una web en escala de grises, avisen: es otro trabajo, mucho más chico (un filtro CSS), y este plan no aplica.

---

## 1. Lo que hay que decidir primero

| # | Decisión | Propuesta | Quién |
|---|---|---|---|
| T-1 | Paleta oscura | **Noche**: el mismo azul de Hielo, más profundo (§4). Alternativas por ver en el lienzo: negro neutro y un híbrido | Grimm y My |
| T-2 | Qué se ve la primera vez | **Sistema**: respeta el tema del aparato. Quien lo cambia a mano lo conserva | Dazz |
| T-3 | Dónde está el interruptor | En el menú de la cuenta y en Configuración. Para quien no tiene sesión, un botón chico en el pie y en el menú del celular | Grimm y My |
| T-4 | Dónde se recuerda | En el aparato (cookie `pl_tema`, 1 año). Con sesión, se guarda también en la cuenta para que siga en otro aparato (fase 2 si aprieta) | Dazz |
| T-5 | Fotos de productos | No se tocan ni se oscurecen. Llevan un borde fino para que no «floten» sobre el fondo oscuro | Grimm y My |
| T-6 | Panel del equipo | Entra en el mismo sprint: su barra ya es oscura, solo cambia el resto | Dazz |

## 2. Cómo está la web hoy

No hay ningún soporte de tema. Los colores salen de `packages/ui` como valores fijos (`#0A1633`, `#2F5BFF`…) y Tailwind los usa tal cual. Medido el 07/11 en `apps/web/src` (85 archivos `.tsx`):

| Qué | Cuántos | Qué implica |
|---|---|---|
| `bg-white` | 58 | Fondo de página, tarjetas, menús y ventanas. Hay que separar «fondo» de «superficie elevada» |
| `text-white` | 36 | Casi todos van sobre azul pase o sobre `tinta`: **no** deben cambiar |
| `border-white/…` | 9 | Bordes sobre las bandas oscuras |
| `bg-tinta` | 17 | Son **fondos oscuros** (pestaña elegida, banda de categorías, barra del equipo, avatares, avisos, interruptor). Si `tinta` pasa a ser clara en el tema oscuro, todos se rompen: hace falta un color propio para «fondo oscuro» |
| `text-tinta`, `border-tinta` | 53 y 19 | Texto y bordes: estos sí se invierten |
| `text-secundario`, `text-detalle` | 148 y 139 | Se invierten con la paleta, sin tocar el código |
| `bg-superficie`, `border-linea`, `border-borde` | 67, 92 y 60 | Igual: cambian con la paleta |
| `ok`, `aviso`, `error` (texto y fondos) | ~90 | Cada uno necesita su versión clara sobre fondo oscuro |
| Colores sueltos en el código | 15 hexadecimales + 12 `rgb()` | Se revisan a mano (§6, día 2) |
| Colores en `globals.css` | 6, el borde giratorio de En vivo | Pasa a usar variables |

**Conclusión:** el trabajo no es pintar de oscuro, es **separar los roles de cada color**. Hoy `tinta` es a la vez el texto y el fondo de las bandas oscuras, y `error` es a la vez el texto y el fondo del botón de peligro. Cuando eso está separado, el resto es poner los valores.

## 3. Cómo se hace

1. **Los tokens pasan a variables CSS.** `packages/ui` deja de exportar hexadecimales fijos y exporta `rgb(var(--tinta) / <alpha-value>)`, así que `bg-tinta/30` y los demás modificadores de opacidad siguen funcionando. Los valores viven en `globals.css`, uno por tema.
2. **Roles nuevos** (los demás conservan su nombre):
   - `fondo`: la página (hoy `bg-white`).
   - `elevado`: menús, ventanas y la tarjeta flotante de En vivo.
   - `fondo-oscuro`: las bandas y avatares que hoy son `bg-tinta`.
   - `pase-texto`: enlaces y acciones escritas en azul. Hoy son `#1F3FC2` sueltos.
   - `error-solido`: el fondo del botón de peligro, que con texto blanco necesita seguir siendo oscuro.
3. **El tema se guarda como atributo** `data-tema="claro|oscuro"` en `<html>`. El servidor lee la cookie `pl_tema` y lo escribe en el HTML; con «Sistema», un script de unas pocas líneas en el `<head>` lo resuelve **antes de pintar**, para que no haya parpadeo blanco.
4. **`color-scheme`** en `<html>` para que las barras de desplazamiento, los campos nativos y el fondo de la pestaña sigan el tema; `theme-color` en la barra del navegador del celular.
5. **La marca**: `marca.tsx` ya tiene variantes (sobre pase, sobre oscuro). Se añade la del tema oscuro; `icon.svg` usa `prefers-color-scheme`.
6. **Íconos de categoría** (`glifo-categoria.tsx`) y el trazo de las miniaturas dejan `#2E3A5A` fijo y toman `currentColor`.

## 4. Paleta oscura «Noche» (propuesta)

Contraste medido con el script `herramientas/contraste_oscuro.py` (mínimo: 4,5:1 en texto, 3:1 en bordes de campos e íconos).

| Rol | Claro | Oscuro | Contraste oscuro |
|---|---|---|---|
| `fondo` | `#FFFFFF` | `#0B1226` | — |
| `superficie` | `#F2F4F8` | `#141D38` | — |
| `elevado` | `#FFFFFF` | `#18234A` | — |
| `tinta` (texto) | `#0A1633` | `#EEF1FA` | 16,5 sobre fondo |
| `secundario` | `#2E3A5A` | `#C3CBE0` | 11,5 |
| `detalle` | `#5A6785` | `#98A3C0` | 7,4 |
| `linea` / `borde` | `#E3E7EF` / `#C8CFDD` | `#243052` / `#34416A` | decorativos (1,4 y 1,9) |
| `borde-control` | `#66728F` | `#7E8BB0` | 5,5 (pide 3) |
| `pase` (botón) | `#2F5BFF` | `#2F5BFF` | 5,2 con texto blanco |
| `pase-texto` | `#1F3FC2` | `#8FA9FF` | 8,2 |
| `pase-suave` | `#EAF0FF` | `#1B2A5C` | 6,1 con `pase-texto` |
| `ok` / `ok-fondo` | `#0B6B4A` / `#DDF4EA` | `#5ED6A3` / `#0F2E24` | 8,1 |
| `aviso` / `aviso-fondo` | `#8A3F00` / `#FFF0E3` | `#FFB27A` / `#33200F` | 8,8 |
| `error` / `error-fondo` | `#8A1C12` / `#FDECEA` | `#FF9A8F` / `#3A1612` | 7,9 |
| `error-solido` | `#8A1C12` | `#B3261E` | 6,5 con texto blanco |
| `fondo-oscuro` | `#0A1633` | `#16224A` | 15,4 con texto blanco |

Los 26 pares medidos pasan en el tema oscuro. El único justo es el borde azul pase sobre el fondo (3,6:1): sirve para íconos y bordes (pide 3), **no** para texto, y por eso el texto azul usa `pase-texto`.

## 5. Sprint · lun 09/11 → vie 13/11

**Meta:** el sábado 14/11 cualquier persona puede cambiar entre Claro, Oscuro y Sistema desde cualquier pantalla, sin parpadeo, y todas las pantallas de la verificación automática pasan en los dos temas.

**Día 1 · lun 09/11 · Decidir y preparar**
- Grimm y My: tablero en el lienzo con 3 propuestas oscuras (Noche, negro neutro, híbrido) sobre inicio, resultados, ficha, mensajes y el panel del equipo. Se elige una (T-1).
- Dazz: inventario de roles (§2) como lista de archivos; las variables CSS con **los mismos valores de hoy** y los roles nuevos. La web debe verse **idéntica** al terminar el día (esa es la prueba).

**Día 2 · mar 10/11 · Separar los roles**
- Reemplazar `bg-white` (58) por `bg-fondo` o `bg-elevado`; `bg-tinta` (17) por `bg-fondo-oscuro` donde sea una banda o avatar; los 15 hexadecimales y los 12 `rgb()`, uno por uno.
- `text-white` solo se queda donde va sobre `pase`, `error-solido` o `fondo-oscuro`.
- Prueba del día: el diff visual de las pantallas en **tema claro** sigue sin diferencias.

**Día 3 · mié 11/11 · Interruptor y persistencia**
- Paleta oscura elegida cargada en `globals.css`.
- Componente `InterruptorTema` (Claro / Oscuro / Sistema) con `role="radiogroup"`; en el menú de la cuenta, en Configuración y en el pie.
- Cookie `pl_tema`, atributo en `<html>`, script anti-parpadeo, `color-scheme`, `theme-color`.
- Marca, íconos de categoría, borde giratorio de En vivo, miniaturas y bordes de fotos.

**Día 4 · jue 12/11 · Verificar**
- Extender `pnpm qa` (`qa/ui.mjs`): cada pantalla en **los dos temas** y los tres anchos; medir el contraste real de cada texto visible contra su fondo; guardar capturas de cada par.
- Pruebas de la unidad: el interruptor, la cookie, «Sistema» con `prefers-color-scheme`.
- Recorrer a mano: ventanas, menús, En vivo, mensajes, publicar, Mis publicaciones, el panel del equipo.

**Día 5 · vie 13/11 · Pulir y salir**
- Arreglar lo que salió del día 4; segunda ronda de capturas con Grimm y My.
- Actualizar `10-design-system.md` (tokens y reglas), este documento y `CHECKLIST.md`.
- CI en verde, *staging*, y sábado 14/11 a producción si todo marcó.

**Holgura:** si el día 2 se alarga (es el más probable), el día 5 absorbe el pulido y la documentación; la persistencia en la cuenta (T-4) queda para la semana siguiente.

## 6. Checklists

### Diseño — Grimm y My
- [ ] Tablero de 3 propuestas oscuras en el lienzo (inicio, resultados, ficha, mensajes, equipo)
- [ ] Elegida la paleta (T-1) y registrada en `10-design-system.md`
- [ ] Estados de cada componente en oscuro: normal, mouse encima, foco, apagado, error
- [ ] Logo e ícono sobre fondo oscuro
- [ ] Fotos de productos sin fondo: ¿se ven bien sobre `fondo`? (T-5)
- [ ] Ubicación del interruptor aprobada (T-3), en celular y en computadora
- [ ] Carruseles del inicio (versión C) revisados en oscuro

### Código — Dazz
- [ ] Variables CSS con los valores de hoy; la web idéntica
- [ ] Roles nuevos: `fondo`, `elevado`, `fondo-oscuro`, `pase-texto`, `error-solido`
- [ ] 58 `bg-white`, 17 `bg-tinta`, 36 `text-white` y 9 `border-white` revisados
- [ ] 15 hexadecimales y 12 `rgb()` revisados
- [ ] `globals.css`: el borde giratorio de En vivo con variables
- [ ] `glifo-categoria.tsx`, `marca.tsx` y `icon.svg`
- [ ] Interruptor de tema accesible (teclado, `aria-checked`, foco visible)
- [ ] Cookie `pl_tema` leída en el servidor; atributo en `<html>`
- [ ] Script anti-parpadeo para «Sistema»
- [ ] `color-scheme` y `theme-color`
- [ ] El panel del equipo y las ventanas (`<dialog>`, `backdrop`) en oscuro
- [ ] Sin hexadecimales nuevos en el código (regla de lint o prueba que los busque)

### Accesibilidad
- [ ] Todo texto con 4,5:1 o más, en los dos temas (medido por la verificación automática)
- [ ] Bordes de campos e íconos con 3:1 o más
- [ ] El foco visible se ve en oscuro (hoy `outline-tinta`: pasa a clara)
- [ ] «Reducir movimiento» sigue respetado
- [ ] El interruptor se anuncia bien en lector de pantalla («Tema: oscuro»)
- [ ] No hay información solo por color (estados `ok`/`aviso`/`error` siguen con ícono o texto)

### Verificación automática (`pnpm qa`)
- [ ] `qa/ui.mjs` corre cada pantalla en `claro` y `oscuro` (cookie `pl_tema`)
- [ ] Contraste real de cada texto visible contra el fondo efectivo
- [ ] Falla si aparece un fondo blanco puro (`rgb(255,255,255)`) en tema oscuro, salvo las fotos
- [ ] Falla si no se puede volver a Claro
- [ ] «Sistema» probado con `Emulation.setEmulatedMedia` (`prefers-color-scheme: dark`)
- [ ] Sin parpadeo: el primer cuadro pintado ya tiene el fondo oscuro
- [ ] Capturas de cada pantalla en los dos temas guardadas en `tools/datos-demo/informes/`

### Salida
- [ ] Format, lint, typecheck y pruebas en verde; CI en verde
- [ ] Revisión de Grimm y My sobre las capturas
- [ ] *Staging* revisado en un celular real, en claro, oscuro y sistema
- [ ] `10-design-system.md`, este documento y `CHECKLIST.md` al día
- [ ] Producción (sáb 14/11), con la reversión lista: el interruptor se esconde con una variable si hay que volver atrás

## 7. Fuera del sprint

- Preferencia guardada en la cuenta (T-4, segunda parte).
- Los correos y los PDF, que no tienen tema.
- Las fotos de productos no se retocan ni se invierten.
- Un cuarto tema (alto contraste).

## 8. Riesgos

| Riesgo | Qué hacer |
|---|---|
| El día 2 es más largo de lo que parece (hay ~90 sitios con color de estado y más de 400 con tokens) | Se hace por pantalla y se verifica con las capturas del claro: si algo cambia, se ve enseguida |
| Parpadeo blanco al cargar en oscuro | La cookie + el script en el `<head>`; y la prueba del primer cuadro |
| Fotos con fondo blanco brillando sobre el oscuro | Borde fino y esquinas redondeadas; si no alcanza, un fondo claro fijo detrás de la foto |
| La verificación automática marca falsos rojos por texto sobre imagen | Esos casos se anotan en la prueba como excepciones con motivo |
| Los carruseles del inicio se terminan a la vez que esto | Usan solo roles (`fondo`, `borde`, `pase-texto`): no tienen que esperar a este sprint |
