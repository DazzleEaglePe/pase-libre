# 11 · Plan de desarrollo

**Versión:** 0.2 · **Fecha:** 29/10/2026 · **Responsable:** Dazz

El plan para llegar al sábado 31/10, cómo va, cómo se prueba y qué sigue después. Sale de las secciones 12 y 13 del [documento 05](05-arquitectura.md#12-plan-de-construcción-al-3110). Las tareas sueltas, con casillas y responsable, están en el [checklist](CHECKLIST.md); este documento da el orden y las fechas.

---

## 1. El plan original (26/10)

| Día | Dazz (API e infraestructura) | Grimm y My (web) | Listo cuando |
| --- | --- | --- | --- |
| **Lun 26/10** | Monorepo, esquema, migraciones, semilla, sesión y primer ingreso. *Staging* en línea | `packages/ui` con tokens y componentes base; barra, pie y acceso | Se entra a *staging* con una cuenta de prueba y se cambia la clave |
| **Mar 27/10** | Catálogo, búsqueda con corrección, ficha por audiencia, prueba de contrato público. Panel del equipo | Portada, resultados y ficha contra la API | Un visitante busca «rtx 3370» y ve la 3070 sin precio ni tienda |
| **Mié 28/10** | Publicar, fotos, Mis publicaciones | Publicar y Mis publicaciones | Un vendedor publica en menos de 2 minutos (RNF-03) |
| **Jue 29/10** | Mensajes en tiempo real, campanita, bloqueo, «Vendido». **Punto de control del plan B** | Mensajes y campanita | Dos tiendas conversan en *staging*. Si no está estable, se sale sin chat |
| **Vie 30/10** | Configuración, límites, respaldos y restauración probada. Carga del piloto | Configuración y repaso en celular | El piloto tiene sus productos y todo pasa en celular |
| **Sáb 31/10** | Despliegue a producción, prueba de humo y monitoreo | Ajustes finales | PaseLibre en línea |

Si un día se atrasa, se recorta en el orden del [documento 04](04-decisiones-para-la-reunion.md#para-llegar-a-halloween) y no se mueve la fecha.

## 2. Cómo va (28/10)

**El código va adelantado; la infraestructura, atrasada.** Todo el código de los días 1 al 5 está hecho, en la API y en la web, y la CI pasa. Lo que se atrasó es lo que depende del servidor: *staging* tenía que estar en línea el lunes y todavía no hay VPS.

| Día del plan | Estado | Commit |
| --- | --- | --- |
| 1 · Monorepo, base, sesión y acceso | Hecho | `727ee3d` |
| 2 · Catálogo, búsqueda, ficha y panel del equipo | Hecho (la web pública llegó el 27/10 por la noche) | `efd5a6d`, `4e04995`, `45befc5` |
| 3 · Publicar, fotos y Mis publicaciones | Hecho | `759deda` |
| 4 · Mensajes, campanita, bloqueo y «Vendido» | Hecho. **El plan B no hace falta:** el chat sale | `37698fc` |
| 5 · Configuración, límites y respaldos | Hecho en código; los respaldos, probados solo en local | `7cb98e0` |
| Extra · Traspasar entre cuentas (A-11) | Hecho | `e494c53` |
| Extra · CI en GitHub Actions | Hecho | `5368716` |
| Extra · Marca Hielo | Hecho en la web; el lienzo sigue sin pasar | `b672cd9` |
| Extra · Kit de despliegue | Hecho y probado en local de punta a punta | `7382d4c` |
| *Staging* | **Atrasado:** espera el VPS y el dominio | — |
| Carga del piloto | **Sin empezar:** espera la lista de Fabrizio | — |

**Ninguno de los recortes del documento 04 hizo falta:** «Vendido», fotos en el chat, filtros de precio y «Publicar uno igual» entraron.

**La web la construyó Dazz** directo desde el lienzo, en lugar de repartirla con Grimm y My como decía el plan. A ellos les queda pasar el lienzo a Hielo y revisar la web en el celular.

## 3. De aquí al sábado

La ruta crítica es **VPS y dominio → *staging* → ensayo → piloto → producción**. Todo lo demás puede ir en paralelo.

| Día | Qué | Quién | Depende de |
| --- | --- | --- | --- |
| **Mié 28/10** | Elegir el VPS y comprar el dominio | Dazz | — |
| | Número de WhatsApp de PaseLibre y lista del piloto | Fabrizio | — |
| | ~~Textos de Términos, Privacidad y Ayuda (borrador), pie con enlaces, `sitemap.xml` y `robots.txt`~~ Hecho | Dazz | — |
| **Jue 29/10** | Servidor, *staging* en línea y la prueba de punta a punta ([checklist §7](CHECKLIST.md#7-prueba-de-punta-a-punta-en-staging)) | Dazz | VPS y dominio |
| | Respaldos con cron, copia a B2 y ensayo de restauración en *staging* | Dazz | *Staging* y cuenta de B2 |
| | Cuentas del piloto creadas en *staging* para que prueben | Equipo | Lista del piloto |
| | Revisión en celulares reales | Grimm y My | *Staging* |
| **Vie 30/10** | Carga del piloto con fotos reales | Fabrizio y el equipo | Cuentas creadas |
| | Script mínimo para unir duplicados y consulta de denuncias | Dazz | — |
| | Arreglos de lo que salga de la prueba | Dazz | Prueba de punta a punta |
| **Sáb 31/10** | Producción, prueba de humo, monitor externo y aviso a las tiendas | Dazz y Fabrizio | Todo lo anterior |

**Si el VPS no está el jueves por la mañana,** *staging* y producción se apretan en el viernes y el sábado, sin ensayo de un día para otro. La decisión de salir igual o mover la fecha es del equipo, y conviene tomarla el jueves.

**Si el piloto no está el viernes,** se sale con el catálogo que haya: una portada vacía no atrae a nadie, así que conviene cargar aunque sean las publicaciones de dos o tres tiendas.

## 4. Pruebas (RNF-32)

**Lo que corre en cada cambio** (la [CI](../.github/workflows/ci.yml), en cada *push* a `main`): formato, lint, tipos, todas las pruebas contra un Postgres 16 real y el *build*, en Node 22.

| Tipo | Dónde | Qué cubre |
| --- | --- | --- |
| **De extremo a extremo de la API** | `apps/api/test/*.e2e-spec.ts` (10 archivos) | Sesión, catálogo, contrato público, publicar, mensajes, cuenta, equipo, traspasar, límites y En vivo, contra una base real (`paselibre_test`) |
| **Contrato público** | `contrato-publico.e2e-spec.ts` | El JSON del visitante no trae `precio`, `tienda`, `stand` ni `whatsapp` |
| **Unitarias** | `packages/contracts`, `apps/api` y `apps/web` | Normalización y corrección de la búsqueda (con casos del chat: «3370», «rtx3070», «ventsu»), contratos, «No molestar» y la consulta de la búsqueda en la web |
| **Humo** | `tools/deploy/scripts/humo.sh` | Después de cada despliegue, desde afuera: salud, portada, búsqueda, visitante sin precio, socket y, con una cuenta, ingresar y salir |

La última corrida completa (29/10, con En vivo): 185 pruebas pasando, 153 de la API, 26 de los contratos y 6 de la web.

**Lo que falta:**

- **Pruebas de navegador.** No hay: la web se revisó a mano en computadora y celular. Para la primera salida, la prueba de punta a punta en *staging* se hace a mano con el [checklist §7](CHECKLIST.md#7-prueba-de-punta-a-punta-en-staging).
- **Una falla intermitente:** `limites.e2e-spec` dio «socket hang up» una vez entre varias corridas. Pasa sola y en la suite completa, y no se encontró la causa. Si la CI da rojo solo por esa prueba, se vuelve a correr y se anota.

## 5. Cómo se trabaja

- **Una rama, `main`,** con un commit por bloque de trabajo y la CI en cada *push*. Mientras el equipo de código sea una persona, no hace falta más.
- **Antes de cada commit:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck` y `pnpm test`. El `pnpm build` no se corre con `pnpm dev` encendido.
- **Cada cambio de la base** es una migración nueva y compatible con el código anterior ([documento 06 §5](06-modelo-de-datos.md#5-migraciones)).
- **Cada cambio de contrato** empieza en `packages/contracts` ([documento 07 §4](07-contrato-de-la-api.md#4-cómo-se-cambia-el-contrato)).
- **Los documentos** se actualizan en el mismo commit que el código que cambian.

## 6. Después del 31/10

La fase 2 está decidida en el [documento 04](04-decisiones-para-la-reunion.md#para-llegar-a-halloween); el orden no. Una propuesta, de lo que más usan las tiendas a lo que menos:

1. **La primera semana:** lo que salga del piloto, el panel para unir duplicados y ver denuncias, el reporte semanal de uso (RF-31) y las búsquedas sin resultados (RF-32).
2. **Encender En vivo** (D-53): ya está construido; falta decidir cuándo y cerrar lo de la [sección 7](#7-en-vivo).
3. **Carga por planilla** (RF-34), si las tiendas grandes no publican una por una.
4. **Aviso por correo** (RF-42) y **página de notificaciones** (RF-66).
5. **Pedir pase con bandeja** (RF-61): el siguiente paso natural del chat.
6. **Registro propio con aprobación** (RF-01, RF-04) y **cuentas de asesores** del dueño (RF-36).
7. **Perfil privado** (RF-41), **tienda pública** (RF-65), **favoritos** (RF-64) y **reputación** (RF-63).
8. **La app del celular**, con la misma API y los mismos contratos.

Se ordena de nuevo con lo que pidan las tiendas en las primeras semanas.

## 7. En vivo

Elegido el 29/10 (D-53): busco y ofertas flash, mostrados con la propuesta E del lienzo. Los requerimientos están en el [documento 02 §5](02-requerimientos-funcionales.md#5-en-vivo-busco-y-ofertas-flash); el modelo, en el [06 §6](06-modelo-de-datos.md#6-fase-2-prevista); las rutas, en el [07 §2.8](07-contrato-de-la-api.md#28-en-vivo-d-53); y las pantallas, en el [09 §3.8](09-ux-y-flujos.md#38-en-vivo-d-53).

En la web se llama **«Pases del día»** y los tipos se leen **«Busco»** y **«Remato»** (29/10); por dentro (código, API y base) sigue siendo En vivo, con BUSCO y FLASH.

**Estado (29/10): construido detrás de un interruptor.** Dazz decidió adelantarlo. Con `EN_VIVO=false` (el valor por defecto, y el de producción) la API responde 404 en sus rutas y la web no muestra nada, así que no cambia lo que sale el sábado. En local está encendido (`.env`). Para encenderlo en un servidor basta `EN_VIVO=true` en su archivo de entorno y reiniciar la API: la web no se vuelve a construir.

**Los pasos, como se planearon:**

| Paso | Qué | Listo cuando |
| --- | --- | --- |
| 1 · Base y contratos | Migración con `en_vivo`, `en_vivo_respuesta`, `conversacion.en_vivo_id` y los valores nuevos de los tipos. Esquemas en `packages/contracts/src/en-vivo/` | `pnpm db:migrate` pasa y el código anterior sigue funcionando con la base nueva |
| 2 · API | Módulo `en-vivo`: listar por audiencia, publicar con el límite de 3, sumar una hora y cerrar, responder (abre el hilo), «Vendido» que descuenta la oferta flash, los avisos y `en-vivo:cambio` a todos los sockets | Pasan `en-vivo.e2e-spec.ts` y la prueba de contrato público con `GET /en-vivo` como visitante |
| 3 · Web: la ventana que te sigue | `features/en-vivo/`: ventana y tarjeta mini en la computadora, la entrada de la banda de categorías; hoja y barra en el celular. Lo que recuerda el navegador (`paselibre:en-vivo`), pausa, teclado y «reducir movimiento». Se monta en el layout del catálogo | Se ve y se comporta como EV_SigueDemo en la portada, la búsqueda y la ficha |
| 4 · Web: publicar, responder y `/pases-del-dia` | Publicar un pase del día (busco o remate), la ventana de «¡Lo tengo!», la tarjeta fija en el chat, `/en-vivo` con «Lo tuyo en vivo» y el tipo de aviso en Configuración | Dos tiendas hacen el recorrido completo en local |
| 5 · Cierre | Privacidad (lo que guarda el navegador), Ayuda, el lienzo al día y la prueba en celulares reales | La CI pasa y los documentos dicen lo que quedó construido |

**Hecho:** los pasos 1 a 4, con 16 pruebas nuevas en la API (`en-vivo.e2e-spec.ts` y `horario.spec.ts`) y revisado en el navegador, en computadora y celular, como visitante y como vendedor.

**Falta del paso 5:** contarlo en Ayuda y probarlo en celulares reales. Privacidad ya dice lo que guarda el navegador.

**Por decidir antes de encenderlo:**

- La hora de «hasta el cierre de hoy»: se propone 8:00 p. m. (Fabrizio).
- Si un busco escrito como texto libre también avisa a las tiendas: se propone que sí, con la misma búsqueda tolerante a errores y solo a las que tienen stock.
- Si el equipo puede quitar desde su panel un busco o una oferta flash denunciada.
