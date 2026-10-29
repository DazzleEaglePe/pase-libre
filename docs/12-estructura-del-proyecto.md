# 12 · Estructura del proyecto

**Versión:** 0.1 · **Fecha:** 28/10/2026 · **Responsable:** Dazz

Qué hay en cada carpeta del repositorio, dónde va cada cosa nueva y los comandos de todos los días. Sale de la sección 11 del [documento 05](05-arquitectura.md#11-estructura-del-código-y-reparto) y de la tabla de carpetas del [README](../README.md). Cómo levantarlo en local, en el README.

---

## 1. El monorepo

Un monorepo pnpm (pnpm 11, Node 22) con turbo, según el patrón de Yallegó (A-01). La API y la web van aparte para que la futura app del celular use la misma API y los mismos contratos sin tocar la web.

```text
paselibre/
├─ apps/
│  ├─ api/                    NestJS 11 · REST /v1 y socket.io en /tiempo-real
│  │  ├─ prisma/              schema.prisma, migraciones, seed.ts y semilla.ts (datos de demostración)
│  │  ├─ scripts/             crear-cuenta-equipo.ts
│  │  ├─ src/
│  │  │  ├─ bootstrap/        configuración de la app: prefijo, cookies, helmet, CORS, /media
│  │  │  ├─ config/           variables de entorno validadas con Zod
│  │  │  ├─ infrastructure/   base de datos (Prisma) y registros (pino)
│  │  │  ├─ modules/          un módulo por tema (ver abajo)
│  │  │  └─ shared/           guards, filtros, pipes, middleware, errores y límites
│  │  ├─ test/                pruebas de extremo a extremo contra una base real
│  │  └─ Dockerfile           imágenes de la API y de las migraciones
│  └─ web/                    Next.js 15 · App Router · Tailwind
│     ├─ src/
│     │  ├─ app/              rutas: (publico), (vendedor), equipo, ingresar, salud
│     │  ├─ features/         una carpeta por pantalla (ver abajo)
│     │  └─ shared/           cliente de la API, tiempo real, fechas y componentes comunes
│     └─ Dockerfile           imagen de la web (standalone)
├─ packages/
│  ├─ contracts/              esquemas Zod, tipos de respuesta y normalización de texto
│  ├─ ui/                     tokens de la línea Hielo (colores y escala tipográfica)
│  ├─ config-eslint/          reglas de ESLint compartidas
│  └─ config-typescript/      tsconfig compartidos
├─ branding/                  marca: logos, íconos, hoja de marca y propuestas (npm, fuera del workspace)
├─ tools/
│  ├─ docker/                 Postgres y Redis para desarrollo
│  └─ deploy/                 compose, nginx, scripts de despliegue y de respaldo, cron y guías
├─ docs/                      documentos 01 a 12 y el checklist
└─ .github/workflows/ci.yml   la CI
```

### Módulos de la API (`apps/api/src/modules`)

| Módulo | Qué hace | Rutas |
| --- | --- | --- |
| `sesion` | Ingreso, salida, contraseña y `GET /yo` | `/sesion`, `/yo` |
| `catalogo` | Portada, búsqueda tolerante, ficha por audiencia | `/portada`, `/buscar`, `/productos`, `/categorias`, `/galerias` |
| `ofertas` | Publicar, editar, Mis publicaciones y sugerencias | `/ofertas`, `/mis-ofertas`, `/catalogo/sugerencias` |
| `archivos` | Subir fotos | `/archivos` |
| `mensajes` | Contactar, conversaciones, bloqueo, denuncias, «Vendido», avisos y contadores | `/conversaciones`, `/ofertas/:id/contacto`, `/avisos`… |
| `tiempo-real` | El socket, las salas y la presencia | `/tiempo-real` |
| `cuenta` | Configuración | `/cuenta` |
| `equipo` | El panel del equipo | `/equipo` |
| `salud` | El estado de la API y de la base | `/salud` |

La lista completa de rutas está en el [documento 07](07-contrato-de-la-api.md).

### Pantallas de la web (`apps/web/src/features`)

| Carpeta | Pantallas |
| --- | --- |
| `catalogo` | Portada, resultados, filtros, orden y ficha |
| `acceso` | Ingresar, primer ingreso y salir |
| `publicar` | Publicar, publicar uno igual, producto nuevo, fotos y vista previa |
| `mis-publicaciones` | Mis publicaciones |
| `mensajes` | Bandeja, conversación y la ventana de «Vendido» |
| `configuracion` | Las cinco secciones de Configuración |
| `equipo` | Cuentas, crear cuenta, acceso enviado y traspasar |

Las rutas de `src/app` solo arman la página y llaman a su carpeta de `features`. Los grupos `(publico)` y `(vendedor)` comparten barra y pie, y deciden quién entra ([documento 09 §2](09-ux-y-flujos.md#2-mapa-de-pantallas)).

## 2. Dónde va cada cosa nueva

| Si es… | Va en… |
| --- | --- |
| Un campo o una ruta nueva de la API | Primero el esquema en `packages/contracts`, después el módulo en `apps/api/src/modules` y su prueba en `apps/api/test` |
| Una tabla o columna | `apps/api/prisma/schema.prisma` y una migración nueva ([documento 06 §5](06-modelo-de-datos.md#5-migraciones)) |
| Una pantalla | Su ruta en `apps/web/src/app` y su carpeta en `apps/web/src/features` |
| Algo que usan varias pantallas | `apps/web/src/shared/ui` |
| Un color o un tamaño | `packages/ui` ([documento 10 §8](10-design-system.md#8-cómo-se-cambia)) |
| Un script de operación | `tools/deploy/scripts`, explicado en `DESPLIEGUE.md` o `RESPALDOS.md` |
| Una decisión | El documento que corresponda, con su ID (D-xx o A-xx) |

**Una carpeta por pantalla** para que dos personas no se pisen (RNF-30). Los nombres de tablas, rutas, campos y carpetas van en español, como la interfaz.

## 3. Comandos

Desde la raíz:

| Comando | Qué hace |
| --- | --- |
| `pnpm docker:up` / `docker:down` / `docker:logs` | Postgres (5435) y Redis (6382) de desarrollo |
| `pnpm dev` | API en `localhost:3001` y web en `localhost:3000` |
| `pnpm dev:api` / `pnpm dev:web` | Solo una de las dos |
| `pnpm db:migrate` | Crea y aplica migraciones en local |
| `pnpm db:deploy` | Aplica las migraciones existentes, sin crear nuevas |
| `pnpm db:seed` | Galerías, categorías y marcas; con `SEMILLA_DEMO=true`, también los datos del lienzo |
| `pnpm db:generate` / `db:validate` | Regenera el cliente de Prisma / valida el esquema |
| `pnpm cuenta:equipo -- --usuario … --nombre …` | La primera cuenta del equipo |
| `pnpm lint` / `typecheck` / `test` / `build` | La revisión completa, igual que la CI |
| `pnpm format` / `format:check` | Prettier (los `.md` no pasan por Prettier, a propósito) |

En el servidor no se usan estos comandos: todo pasa por `tools/deploy/scripts/desplegar.sh` ([DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md)).

## 4. Documentos

| Documento | Para qué |
| --- | --- |
| [README](../README.md) | Qué es PaseLibre y cómo correrlo en local |
| [01 · Contexto y análisis](01-contexto-y-analisis.md) | Origen, problema, decisiones (D-xx), riesgos y preguntas |
| [02 · Requerimientos funcionales](02-requerimientos-funcionales.md) | Qué hace el sistema (RF-xx) |
| [03 · Requerimientos no funcionales](03-requerimientos-no-funcionales.md) | Cómo se comporta (RNF-xx) |
| [04 · Decisiones y pendientes](04-decisiones-para-la-reunion.md) | Lo decidido, lo pendiente y los recortes |
| [05 · Arquitectura](05-arquitectura.md) | Principios, decisiones de arquitectura (A-xx), vista general, búsqueda, mensajes e infraestructura |
| [06 · Modelo de datos](06-modelo-de-datos.md) | Tablas, reglas e índices |
| [07 · Contrato de la API](07-contrato-de-la-api.md) | Rutas, errores y tiempo real |
| [08 · Seguridad y autenticación](08-seguridad-y-autenticacion.md) | Ingreso, sesiones, quién ve qué y límites |
| [09 · UX y flujos](09-ux-y-flujos.md) | Pantallas y recorridos |
| [10 · Design system](10-design-system.md) | Línea gráfica Hielo, componentes y voz |
| [11 · Plan de desarrollo](11-plan-de-desarrollo.md) | Fechas, avance, pruebas y fase 2 |
| [12 · Estructura del proyecto](12-estructura-del-proyecto.md) | Este documento |
| [Checklist](CHECKLIST.md) | Lo que falta para salir, con casillas |
| [DESPLIEGUE.md](../tools/deploy/DESPLIEGUE.md) y [RESPALDOS.md](../tools/deploy/RESPALDOS.md) | Servidor, despliegue y respaldos |
