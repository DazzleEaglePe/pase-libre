# PaseLibre

> Marketplace básico y liviano para que las tiendas de **Galería Wilson** (Lima) encuentren productos de PC entre ellas, sin intermediar la venta.

**Estado (28/10/2026):** Fase 1 — primera salida. El código de los días 1 al 5 está hecho en la API y la web (catálogo, publicar, mensajes en tiempo real, configuración y panel del equipo), con la CI en verde y el kit de despliegue probado en local. Falta el servidor: *staging* espera el VPS y el dominio. Lo pendiente está en el [checklist](docs/CHECKLIST.md).
**Versión de la documentación:** 0.8 (borrador), armada a partir del chat del grupo «PaseLibre compra y ventas» del 22 al 24/10/2026, las respuestas del equipo a las preguntas abiertas y las decisiones de arquitectura de Dazz. Los documentos 06 a 12 (28/10) salen de la arquitectura y del código.

---

## ¿Qué es?

En las galerías tecnológicas de Lima, cuando una tienda necesita un producto que no tiene, le pide un **«pase»** o **«libre»** a otra tienda: busca por la web, contacta, pregunta si lo tienen y a qué precio. Hoy ese proceso es manual, lento y depende de que la otra tienda responda.

**PaseLibre** es una interfaz tipo marketplace/OLX, «básica y chikita», donde las tiendas y los vendedores independientes **publican lo que tienen** (y lo que buscan) para que otras tiendas lo encuentren rápido y se contacten directo por WhatsApp.

## ¿Qué NO es?

- **No es Mercado Libre.** No intermedia ventas, no cobra pagos, no gestiona envíos.
- **No tiene app todavía.** Primero la web; la app llega después, con la misma cuenta.
- **No es un catálogo general.** Se enfoca 100 % en Wilson y en componentes de PC y periféricos.

## Propuesta de valor

| Para… | PaseLibre da… |
| --- | --- |
| La tienda que **necesita** un producto | Buscar en todas las galerías a la vez (o por galería) y contactar al vendedor en un clic |
| La tienda o el independiente que **tiene** el producto | Publicarlo gratis, con la opción de **no mostrar el precio** («Al interno») |
| El negocio (Fabrizio) | Una plataforma gratuita para captar tiendas ahora y negociar porcentajes si funciona |

## Alcance de la primera versión (propuesto)

1. **Catálogo público sin precio ni datos de la tienda**, para que quien busque un producto lo encuentre. La interfaz se inspira en eBay ([lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A)).
2. **Iniciar sesión** con correo o usuario y contraseña. Las cuentas las entrega el equipo a dueños de tienda y asesores; «Crear cuenta» muestra un aviso de mantenimiento.
3. **Un producto, varias ofertas:** cada vendedor publica su oferta sobre un producto del catálogo y la ficha muestra «Otras ofertas de este producto», de menor a mayor precio.
4. Publicar con **stock** y precio visible u oculto (**oculto por defecto**), en dólares o soles, o con **«Publicar uno igual»** desde una ficha.
5. Buscar con tolerancia a errores de tipeo y filtrar por categoría y por galería.
6. **Mensajes:** chat de la web con filtros, respuestas rápidas, fotos, archivar y bloquear, además del botón de **WhatsApp**. Cada persona ve sus propias conversaciones.
7. **Configuración:** datos de la cuenta, cambio de contraseña y avisos.
8. *(Si hay tiempo)* Botón **«Vendido»** en el chat que descuenta el stock.
9. *(Fase 2)* Registro propio con aprobación, aviso por correo, precio por rol, cuentas de asesores, En vivo (busco y ofertas flash), pedir pase con bandeja, preguntas públicas, reputación, favoritos, tienda pública, notificaciones y la app.

El detalle está en [`docs/02-requerimientos-funcionales.md`](docs/02-requerimientos-funcionales.md).

## Cómo correrlo en local

Requisitos: Node 22 o más, pnpm 11 y Docker.

```bash
cp .env.example .env
pnpm install
pnpm docker:up        # Postgres en 5435 y Redis en 6382, aparte de los de Yallegó
pnpm --filter @paselibre/contracts build
pnpm db:migrate       # aplica las migraciones
pnpm db:seed          # galerías, categorías y marcas; con SEMILLA_DEMO=true, también los datos del lienzo
pnpm dev              # API en http://localhost:3001 y web en http://localhost:3000
```

- **Cuentas de demostración:** las crea la semilla con los usuarios del lienzo (`tiendaa`, `tiendab`, `tiendad`…, y `equipo`). La clave está en `apps/api/prisma/semilla.ts` (`CLAVE_DEMO`) y se cambia con la variable de entorno del mismo nombre: en *staging* hay que cambiarla, porque el repositorio es público. `tiendad` y `jorge.r` entran por primera vez y deben crear su contraseña. Volver a correr la semilla deja las cuentas demo como al inicio.
- **Primera cuenta del equipo en staging o producción** (sin semilla demo): `pnpm cuenta:equipo -- --usuario dazz --nombre "Dazz"`. Muestra una clave temporal una sola vez. Con esa cuenta se entra a `/equipo/cuentas` y desde ahí se crean las cuentas de las tiendas.
- **Fotos:** las que se suben en local quedan en `apps/api/media` (fuera de git); la web las muestra en `/media`. Se cambia con `MEDIA_DIR`.
- **Pruebas:** `pnpm test`. Las de la API usan `TEST_DATABASE_URL` (la base `paselibre_test`), nunca la de desarrollo, y guardan sus fotos en una carpeta temporal.
- **No correr `pnpm build` con `pnpm dev` encendido:** el build pisa `apps/web/.next` y el servidor de desarrollo se rompe. Si pasa, borrar `apps/web/.next` y volver a levantarlo.
- **Revisión completa:** `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
- **Respaldos:** `tools/deploy/scripts/respaldar.sh`, `restaurar.sh` y `ensayar-restauracion.sh`; cómo usarlos en [tools/deploy/RESPALDOS.md](tools/deploy/RESPALDOS.md).
- **Despliegue en un servidor:** Dockerfiles de la API y la web, `tools/deploy/compose.yml`, nginx y `tools/deploy/scripts/desplegar.sh` (construye, respalda, migra, cambia las imágenes y hace la prueba de humo). Cómo preparar el servidor y usarlo, en [tools/deploy/DESPLIEGUE.md](tools/deploy/DESPLIEGUE.md).

| Carpeta | Qué hay |
| --- | --- |
| `apps/api` | API NestJS: `prisma/` (esquema, migraciones y semilla), `src/modules/` (sesion, cuenta, catalogo, ofertas, archivos, mensajes, tiempo-real, equipo, salud), `test/` (e2e, incluida la prueba de contrato público) |
| `apps/web` | Web Next.js: `src/app/` (rutas), `src/features/` (una carpeta por pantalla), `src/shared/` (API y componentes comunes) |
| `packages/contracts` | Esquemas Zod, tipos de respuesta y la normalización de texto que comparten la web, la API y la futura app |
| `packages/ui` | Tokens de la línea gráfica Hielo (colores y escala tipográfica), que usa Tailwind |
| `branding` | La marca: el símbolo, los logos, los íconos y la hoja de marca (`cd branding && npm install && npm run generar`), y la hoja de propuestas de línea gráfica (`npm run propuestas`). Va aparte del workspace, con npm |
| `tools/docker` | Postgres y Redis para desarrollo |
| `tools/deploy` | Despliegue (compose, nginx, scripts) y respaldos (scripts, cron y guías) |

## Equipo y roles

| Persona | Rol según el chat |
| --- | --- |
| **Fabrizio** (CENTRO LIMA) | Impulsor del proyecto. Financia, negocia y ofrece la plataforma a las tiendas en persona |
| **Dazz (Bruno)** | Arquitectura y desarrollo. Arma el plan de arquitectura, infraestructura, lenguajes y frameworks |
| **Grimm** (@anderson_cob) | Interfaz. Construyó el prototipo «TechGallery» |
| **My** | Interfaz (a dividir con Grimm) |

## Documentación

| Archivo | Contenido |
| --- | --- |
| [`docs/01-contexto-y-analisis.md`](docs/01-contexto-y-analisis.md) | Origen, problema, decisiones tomadas, riesgos y preguntas abiertas |
| [`docs/02-requerimientos-funcionales.md`](docs/02-requerimientos-funcionales.md) | Qué debe hacer el sistema |
| [`docs/03-requerimientos-no-funcionales.md`](docs/03-requerimientos-no-funcionales.md) | Cómo debe comportarse: rendimiento, seguridad, usabilidad, costos |
| [`docs/04-decisiones-para-la-reunion.md`](docs/04-decisiones-para-la-reunion.md) | Lo ya decidido, lo pendiente con recomendación y el plan para llegar a Halloween |
| [`docs/05-arquitectura.md`](docs/05-arquitectura.md) | Resumen de la arquitectura: principios, decisiones (A-xx), vista general, búsqueda, mensajes, infraestructura y riesgos |
| [`docs/06-modelo-de-datos.md`](docs/06-modelo-de-datos.md) | Tablas, reglas que cuida la base, índices y migraciones |
| [`docs/07-contrato-de-la-api.md`](docs/07-contrato-de-la-api.md) | Rutas de `/v1`, errores, tiempo real y cómo se cambia un contrato |
| [`docs/08-seguridad-y-autenticacion.md`](docs/08-seguridad-y-autenticacion.md) | Roles, quién ve qué, ingreso, sesiones, límites y lo que falta |
| [`docs/09-ux-y-flujos.md`](docs/09-ux-y-flujos.md) | Pantallas, quién entra a cada una y los recorridos principales |
| [`docs/10-design-system.md`](docs/10-design-system.md) | Línea gráfica Hielo: color, tipografía, medidas, íconos, logo, componentes y voz |
| [`docs/11-plan-de-desarrollo.md`](docs/11-plan-de-desarrollo.md) | Plan al 31/10, cómo va, pruebas y orden de la fase 2 |
| [`docs/12-estructura-del-proyecto.md`](docs/12-estructura-del-proyecto.md) | Carpetas, dónde va cada cosa nueva y comandos |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | Lo que falta para salir, con casillas y responsable |
| [`tools/deploy/DESPLIEGUE.md`](tools/deploy/DESPLIEGUE.md) y [`RESPALDOS.md`](tools/deploy/RESPALDOS.md) | Servidor, despliegue, respaldos y restauración |
| [Lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A) | Flujos y pantallas: versión A, versión B (eBay y Mercado Libre), cuenta, mensajes y configuración (con ideas de AliExpress) y la **línea final**, con las 13 pantallas de la primera salida y el mapa de rutas. Privado hasta que se comparta |

## Próximos pasos

1. Elegir el VPS y comprar el dominio, para poner *staging* en línea ([plan](docs/11-plan-de-desarrollo.md#3-de-aquí-al-sábado)).
2. Conseguir el número de WhatsApp de PaseLibre.
3. Fabrizio confirma los vendedores del piloto y su stock, para cargarlo el 30/10.
4. Revisar los borradores de Términos, Privacidad y Ayuda, y definir quién responde legalmente por PaseLibre.

**Meta:** salir **antes de Halloween (31/10)**. Con el chat dentro de la web el alcance es ajustado, por eso [`docs/04`](docs/04-decisiones-para-la-reunion.md) trae una lista de recortes y un plan B.
