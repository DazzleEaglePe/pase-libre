# 15 · Calidad: seguridad, rendimiento, pruebas y diseño

**Fecha:** lunes 09/11/2026 · **Estado:** auditado y con lo urgente arreglado; lo pendiente está en §6

Cuatro revisiones en paralelo, de solo lectura, sobre todo el código: **seguridad**, **rendimiento**, **pruebas** y **diseño/UX** (con el lienzo «Versión final» como referencia). Además, una **prueba de carga** de la API con 156 tiendas y unas 2 450 ofertas. Este documento dice qué se encontró, qué se arregló, con qué pruebas y qué falta.

## 1. Seguridad

La regla de oro se cumple: **un visitante nunca recibe precio, tienda, stand ni WhatsApp**. Lo grave estaba en «tienda reservada»: otra tienda con sesión podía averiguar quién era.

| Hallazgo | Riesgo | Arreglo |
| --- | --- | --- |
| La lista de «Tiendas bloqueadas» mostraba el nombre real de la tienda reservada | Alto | `bloqueo.reservada`: se lista como «Tienda reservada» con el id del bloqueo, no el de la tienda |
| El chat devolvía el id real de quien vende (y si estaba en línea), que se podía cruzar con sus otros chats | Alto | Id vacío, «en línea» falso y sin «última conexión» |
| Pases del día: una oferta reservada se podía rematar (el remate muestra tienda y stand), y «¡Lo tengo!» decía el nombre real | Medio | No se remata; quien responde con una oferta reservada sale como «Tienda reservada» |
| Contadores de intentos (ingreso y código del registro) se pisaban con pedidos simultáneos | Medio | Una sola sentencia SQL atómica; prueba con 8 intentos a la vez |
| La cuenta bloqueada respondía distinto que la clave mala: decía qué usuarios (o celulares) existen | Medio | Misma respuesta y mismo tiempo en los dos casos |
| El límite «por persona» se saltaba con una cookie inventada en cada pedido; una IPv6 estrenaba dirección por pedido | Bajo | Solo cuenta por cookie una sesión ya validada; IPv6 por su /64 |
| Fotos de hasta 50 MP podían agotar la memoria de la API | Bajo | 24 MP |
| Un NUL en `?categoria=` daba 500 | Bajo | Slugs solo con `a-z0-9-` |
| El código de consulta del registro quedaba en los logs | Bajo | Se escribe `[oculto]` |
| La contraseña del registro no pedía un número | Bajo | Mismas reglas que «Crea tu contraseña» |
| El sitemap consultaba la API en cada pedido | Bajo | Una vez por hora |

**Pendiente de seguridad:** ver §6.

## 2. Rendimiento

**Prueba de carga** (`tools/carga`, resultados completos en su README). Misma máquina antes y después:

| Visitantes, 50 a la vez, una IP por pedido | Antes | Después |
| --- | --- | --- |
| Pedidos por segundo | 741 | **2 071** |
| p95 portada | 80 ms | 23 ms |
| p95 ficha | 60 ms | 35 ms |
| p95 búsqueda | 89 ms | 56 ms |
| p95 categorías | 22 ms | 2 ms |
| Errores | 0 | 0 |

Lo que cambió:

- **API:** categorías, galerías y totales un minuto en memoria; «Responde en ~N min» 15 minutos por tienda; el último mensaje de cada chat con `DISTINCT ON` (antes Prisma traía todos los mensajes de cada hilo y cortaba en memoria); 4 índices nuevos (portada, «responde en», avisos, «Cerrados hoy»); el límite por IP sube de 600 a 3 000 por minuto (una galería entera sale por el mismo wifi).
- **Web:** sin cookie no se pregunta por la sesión; los eventos seguidos del socket se juntan en una sola recarga (antes un mensaje disparaba 4 a 5 pedidos de la bandeja); cada pestaña espera un poco distinto ante un cambio de Pases del día; la foto principal de la ficha se pide primero; los contratos se marcan sin efectos secundarios.
- **Despliegue:** `connection_limit=15` en la base (antes 5 conexiones en un VPS de 2 núcleos).

**Iniciar sesión** es lo más caro (argon2): 55 por segundo y p95 de 0,5 s con 20 a la vez; si entran 150 juntas, p95 de 2,9 s.

## 3. Pruebas

| | Antes | Ahora |
| --- | --- | --- |
| API (e2e + unidad) | 191 | **221**: 30 nuevas: tienda reservada, intentos simultáneos y las primeras pruebas de unidad, sin base: IPv6, límites, caché, configuración de producción, quién ve qué |
| Contratos | 33 | **34** |
| Web | 18 | **27**: primeras pruebas de componentes (formulario del registro y su página de estado) |

- **Un error real que salió de la revisión:** «1.699.90» se leía como 169 990 (cien veces el precio). Ahora se rechaza y el formulario pide escribirlo bien.
- **La prueba que fallaba una de cada tres veces** (`limites.e2e-spec`, «socket hang up») era supertest abriendo un servidor por pedido en `::`, que en macOS a veces tomaba un puerto ocupado en 127.0.0.1. Ahora la app de pruebas escucha una vez en 127.0.0.1.
- **Grupos de vitest:** la API tiene `unidad` (sin Postgres) y `e2e`; la web, `unidad` (node) y `componentes` (jsdom con Testing Library).

## 4. Diseño: menos «hecho por IA»

Principios que salieron de la revisión, para todo lo que siga:

1. **Mostrar stock, no promesas.** Cada bloque muestra producto, tienda, stand, precio o tiempo. Lo que serviría para cualquier marketplace, se corta.
2. **Palabras antes que íconos.** Categorías y galerías van en texto con su cuenta («Gráficas 25»). Nada de íconos dentro de formas de color.
3. **Un verde por pantalla.** Solo la acción principal es verde; la jerarquía sale del peso y el tamaño.
4. **Denso como un mostrador.** Producto, luego estado · lugar · cuándo, luego precio. Sin «0 disponibles».
5. **Hablar como la galería, con precisión.** Horas de reloj («antes de las 7:12 p. m.»), cuentas exactas («Ver los 116 productos»).

Hecho:

- El **pie** es el D_Pie del lienzo: fondo tinta, invitación en una banda verde y las ventajas en texto. Se quitaron la franja de íconos de arriba, los sellos y el «Libro de Reclamaciones» con forma de botón y sin enlace.
- **Portada de visitante** como D_Portada: sin la caja gris; los números en una línea y «¿Cómo pido una cuenta?» como botón.
- **Categorías** en chips de texto con su cuenta, en vez de tarjetas con dibujos.
- **Tarjetas** en el orden del diseño; «Recién publicado» ya no trae ofertas sin stock.
- **Fotos** sin recortar: antes se cortaba el modelo escrito en la caja.
- **Pases del día:** sin el brillo que giraba; un solo rojo para «en vivo» (token `vivo`); sombras sin el azul viejo.
- **Accesibilidad:**
  - Foco visible sobre fondos oscuros y en el buscador.
  - Botones de 44 px en celular.
  - En el registro, errores atados a su campo y el foco va al paso o al primer error.
- **Textos:** títulos, secciones y precios en 700, como el lienzo. «Celular, correo o usuario» en el ingreso, y se arregló el botón «Crear la cuenta de mi tienda», que se desbordaba.
- **Estado de la solicitud:** sin medallones de íconos; con la hora límite y «Tus primeros pasos».
- **Pantallas de carga** con la forma de las tarjetas, para el catálogo y la ficha.

## 5. Cómo se mide de nuevo

```bash
pnpm test
pnpm --filter @paselibre/api exec vitest run --project unidad
pnpm --filter @paselibre/web exec vitest run --project componentes
node tools/carga/carga.mjs --api=http://localhost:3031 --escenario=visitante --usuarios=50 --segundos=30 --ip-por-pedido
```

## 6. Lo que queda, en orden

**Antes de encender el registro propio (`REGISTRO_PROPIO`)**

- [ ] Hoy el RUC aprueba solo, pero SUNAT confirma que el RUC existe y no que sea de quien lo escribe; el padrón de RUC es público. Hay que decidir entre dos caminos: (a) un RUC por tienda y tratar las cuentas aprobadas por RUC como visitantes para contactar hasta que el equipo las mire; o (b) revisión humana siempre. **Decisión de Fabrizio y Dazz**
- [ ] Proveedores reales de SMS y de consulta a SUNAT (L-5 del [14](14-lienzo-final.md))

**Seguridad**

- [ ] Cualquiera puede dejar en espera una cuenta ajena con 5 claves malas: contar los intentos por cuenta **e** IP
- [ ] «Contactar por WhatsApp» con tope por usuario en la base, no solo por sesión
- [ ] CSP en la web
- [ ] Vencimiento de las claves temporales
- [ ] Actualizar `@nestjs/platform-express` (multer, 4 avisos altos) y `zod` (`pnpm audit --prod`: 7 altos, 0 críticos)
- [ ] Procesar las fotos de a una (sharp y argon2 comparten los 4 hilos de libuv)

**Rendimiento**

- [ ] **Fotos de 400 px** para tarjetas y miniaturas: hoy cada tarjeta baja la de 1 600 px (2 a 4 MB por página de resultados en el wifi de la galería)
- [ ] El socket se reconecta al pasar del catálogo a Mensajes: un solo proveedor en el layout raíz
- [ ] Revisar la sesión con una consulta, no cuatro (`relationJoins` o un caché corto)
- [ ] «Lo más buscado» precalculado cada 5 a 10 minutos
- [ ] La corrección de tipeo en una sola consulta (hoy hasta 12 a la vez)
- [ ] Pases del día: mandar el cambio en el evento en vez de que todas las pestañas recarguen la lista
- [ ] socket.io-client solo para quien tiene sesión

**Pruebas**

- [ ] Vencimientos a través de la API: busco vencido, sesión vencida, bloqueo que se levanta, código del registro vencido
- [ ] Concurrencia: dos «¡Lo tengo!» a la vez, aprobar dos veces, publicar lo mismo dos veces
- [ ] Paginación de resultados sin repetidos; filtro en soles; «Más caro primero»
- [ ] Componentes: buscador (teclado y sugerencias), chat (eco del socket), publicar (vista previa del precio)
- [ ] Cobertura (`@vitest/coverage-v8`) y `pnpm qa` en la CI

**Diseño**

- [ ] **Barra de arriba como D_Barra** (122 px, verde, sin la franja de ventajas). Hoy son cuatro barras y unos 200 px. Espera la edición a mano de `cabecera.tsx` que está a medias
- [ ] Ingreso con el diseño partido de D_Acceso; registro como flujo enfocado (sin la barra del sitio en celular)
- [ ] Panel del equipo con su propia barra (REG_Admin)
- [ ] «Recién publicado» con sesión: el lienzo muestra 2 filas de 6. Se queda el carrusel C, que elegiste el 07/11
- [ ] Un `<Boton>` y un `<Chip>` compartidos (hoy hay seis copias de estilos de botón) y solo tres radios
- [ ] «Pases del día» o «Pedidos en vivo»: decidir el nombre (L-2)
