# 11 · Plan de desarrollo

**Versión:** 0.1 · **Fecha:** 28/10/2026 · **Responsable:** Dazz

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
| **De extremo a extremo de la API** | `apps/api/test/*.e2e-spec.ts` (9 archivos) | Sesión, catálogo, contrato público, publicar, mensajes, cuenta, equipo, traspasar y límites, contra una base real (`paselibre_test`) |
| **Contrato público** | `contrato-publico.e2e-spec.ts` | El JSON del visitante no trae `precio`, `tienda`, `stand` ni `whatsapp` |
| **Unitarias** | `packages/contracts`, `apps/api` y `apps/web` | Normalización y corrección de la búsqueda (con casos del chat: «3370», «rtx3070», «ventsu»), contratos, «No molestar» y la consulta de la búsqueda en la web |
| **Humo** | `tools/deploy/scripts/humo.sh` | Después de cada despliegue, desde afuera: salud, portada, búsqueda, visitante sin precio, socket y, con una cuenta, ingresar y salir |

La última corrida completa (28/10): 165 pruebas pasando, 133 de la API, 26 de los contratos y 6 de la web.

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
2. **Carga por planilla** (RF-34), si las tiendas grandes no publican una por una.
3. **Aviso por correo** (RF-42) y **página de notificaciones** (RF-66).
4. **Pedir pase con bandeja** (RF-61): el siguiente paso natural del chat.
5. **Registro propio con aprobación** (RF-01, RF-04) y **cuentas de asesores** del dueño (RF-36).
6. **Perfil privado** (RF-41), **tienda pública** (RF-65), **favoritos** (RF-64) y **reputación** (RF-63).
7. **La app del celular**, con la misma API y los mismos contratos.

Se ordena de nuevo con lo que pidan las tiendas en las primeras semanas.
