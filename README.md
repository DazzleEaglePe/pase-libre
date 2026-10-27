# PaseLibre

> Marketplace básico y liviano para que las tiendas de **Galería Wilson** (Lima) encuentren productos de PC entre ellas, sin intermediar la venta.

**Estado:** Fase 1 — construcción de la primera salida. Día 1 listo (monorepo, base de datos, semilla e inicio de sesión). Día 2: el catálogo, la búsqueda con corrección y la ficha por audiencia ya responden en la API.
**Versión de la documentación:** 0.8 (borrador, 26/10/2026), armada a partir del chat del grupo «PaseLibre compra y ventas» del 22 al 24/10/2026, las respuestas del equipo a las preguntas abiertas y las decisiones de arquitectura de Dazz.

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
9. *(Fase 2)* Registro propio con aprobación, aviso por correo, precio por rol, cuentas de asesores, requerimientos, pedir pase con bandeja, preguntas públicas, reputación, favoritos, tienda pública, notificaciones y la app.

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

- **Cuentas de demostración:** las crea la semilla con los usuarios del lienzo (`tiendaa`, `tiendab`, `tiendad`…, y `equipo`). La clave está en `apps/api/prisma/semilla.ts` (`CLAVE_DEMO`). `tiendad` y `jorge.r` entran por primera vez y deben crear su contraseña. Volver a correr la semilla deja las cuentas demo como al inicio.
- **Primera cuenta del equipo en staging o producción** (sin semilla demo): `pnpm cuenta:equipo -- --usuario dazz --nombre "Dazz"`. Muestra una clave temporal una sola vez.
- **Pruebas:** `pnpm test`. Las de la API usan `TEST_DATABASE_URL` (la base `paselibre_test`), nunca la de desarrollo.
- **Revisión completa:** `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.

| Carpeta | Qué hay |
| --- | --- |
| `apps/api` | API NestJS: `prisma/` (esquema, migraciones y semilla), `src/modules/` (sesion, cuenta, catalogo, salud), `test/` (e2e, incluida la prueba de contrato público) |
| `apps/web` | Web Next.js: `src/app/` (rutas), `src/features/` (una carpeta por pantalla), `src/shared/` (API y componentes comunes) |
| `packages/contracts` | Esquemas Zod, tipos de respuesta y la normalización de texto que comparten la web, la API y la futura app |
| `packages/ui` | Tokens de la línea final del lienzo (colores y escala tipográfica), que usa Tailwind |
| `tools/docker` | Postgres y Redis para desarrollo |

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
| [`docs/05-arquitectura.md`](docs/05-arquitectura.md) | Stack, modelo de productos y ofertas, quién ve qué, rutas y API, búsqueda, mensajes, seguridad, despliegue y plan día por día al 31/10 |
| [Lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A) | Flujos y pantallas: versión A, versión B (eBay y Mercado Libre), cuenta, mensajes y configuración (con ideas de AliExpress) y la **línea final**, con las 13 pantallas de la primera salida y el mapa de rutas. Privado hasta que se comparta |

## Próximos pasos

1. Validar la [arquitectura](docs/05-arquitectura.md) y decidir el servidor (VPS nuevo o el de Yallegó) y el dominio.
2. Preguntarle a Grimm en qué está hecha su maquetación, para saber qué se reutiliza.
3. Arrancar el lunes 26/10 con el monorepo y *staging*, según el plan día por día del documento 05.
4. Fabrizio confirma los vendedores del piloto y su stock, para cargarlo el 30/10.

**Meta:** salir **antes de Halloween (31/10)**. Con el chat dentro de la web el alcance es ajustado, por eso [`docs/04`](docs/04-decisiones-para-la-reunion.md) trae una lista de recortes y un plan B.
