# 20b · Tiendas fundadoras: 15 lugares y las que ya estaban registradas

**Fecha:** 13/11/2026 · **Para:** Bruno · **Versión:** 1.11.1 (solo un retoque de la 1.11.0)
Revisado contra `main` en `17dc7a7`.

## Qué pidió Fabrizio

Con la 1.11.0 subida, la tarjeta del Inicio dice **«★ Tiendas fundadoras · 0 de 10 ya entraron»**. Pidió dos cosas:

1. **Las tiendas que ya están registradas tienen que aparecer** como fundadoras. Hoy no sale ninguna porque nadie las agregó a mano en el panel.
2. **Son 15 lugares, no 10.**

## 1 · Son 15

- **`packages/contracts/src/equipo/fundadoras.ts:7`:** `MAX_FUNDADORAS = 15`.
  - La API (`fundadoras.service.ts:114-118`, «Ya están las N») y la tarjeta (`inicio.service.ts:390`) ya usan la constante.
- **Comentarios que dicen 10**, para que no confundan después:
  - `fundadoras.service.ts:47` y `65-66`;
  - `fundadoras.controller.ts:45`;
  - `inicio.service.ts:381`;
  - `apps/web/src/features/equipo/fundadoras.tsx:18`, `22` y `149`;
  - `apps/web/src/features/inicio/piloto.tsx:33-34`.
- **`apps/api/test/inicio-1-11-0.e2e-spec.ts:421-454`:** cambia los números escritos a mano por la constante.
  - `'Ya están las 10'` pasa a `` `Ya están las ${MAX_FUNDADORAS}` ``.
  - Los `toBe(10)` y `toHaveLength(10)` pasan a `MAX_FUNDADORAS`.
  - El título de la prueba pasa a «máximo 15».

## 2 · Las que ya estaban registradas entran como fundadoras

**Migración nueva** (no toques la `20261114110100_tienda_fundadora`, que ya está aplicada):

```sql
-- doc 20b: las tiendas que ya estaban registradas entran como fundadoras,
-- de la más antigua a la más nueva, hasta llenar los 15 lugares.
WITH elegidas AS (
  SELECT id, row_number() OVER (ORDER BY creada_en, nombre) AS n
  FROM tienda
  WHERE estado = 'ACTIVA' AND fundadora_desde IS NULL
  ORDER BY creada_en, nombre
  LIMIT GREATEST(0, 15 - (SELECT count(*) FROM tienda WHERE fundadora_desde IS NOT NULL))
)
UPDATE tienda t
SET fundadora_desde = t.creada_en,               -- «Tienda fundadora desde» = cuando se registró
    fundadora_dia   = ((e.n - 1) % 6) + 1        -- lunes, martes… sábado, y vuelve a empezar
FROM elegidas e
WHERE t.id = e.id;
```

- `fundadora_desde = creada_en` hace que el perfil diga la fecha real («Tienda fundadora desde nov. 2026»), no el día de la migración.
- Los días se reparten en orden, así no caen todas el mismo día. Después Fabrizio puede cambiarlos en **Panel › Tiendas › Fundadoras**.
- El sello y la prioridad en el chat quedan prendidos (`DEFAULT true`).
- **Después de migrar, revisa la lista con Fabrizio.** Si hay alguna tienda de prueba (una del Equipo, por ejemplo), se quita desde el panel y su lugar queda libre.

## 3 · Las nuevas entran solas mientras haya lugar

Si no, el «Invita a una tienda vecina» de la tarjeta no tendría sentido: la vecina entraría y no sería fundadora.

Cuando se crea una tienda, entra como fundadora si quedan lugares. Se crean en dos sitios:

- `registro.service.ts:488`, en `aprobarEnTx` (al aprobar una solicitud);
- `equipo.service.ts:209` (cuando el Equipo crea la cuenta).

En los dos, dentro de la **misma transacción** y justo después del `tienda.create`, llama a un ayudante nuevo en `FundadorasService` (o en `shared/fundadoras.ts`):

```ts
/** Entra como fundadora si quedan lugares (doc 20b). Lo usan el registro y «Crear cuenta». */
export async function entrarSiHayLugar(tx: Prisma.TransactionClient, tiendaId: string): Promise<void> {
  // Un candado para esta transacción: dos altas a la vez no pasan de MAX_FUNDADORAS.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fundadoras'))`;
  const dias = await tx.tienda.groupBy({
    by: ['fundadoraDia'],
    where: { fundadoraDesde: { not: null } },
    _count: { _all: true },
  });
  const yaSon = dias.reduce((total, fila) => total + fila._count._all, 0);
  if (yaSon >= MAX_FUNDADORAS) return;
  const usados = new Map(dias.map((fila) => [fila.fundadoraDia, fila._count._all]));
  const dia =
    [...DIAS_FUNDADORA].sort((a, b) => (usados.get(a.dia) ?? 0) - (usados.get(b.dia) ?? 0))[0]?.dia ?? 1;
  await tx.tienda.update({
    where: { id: tiendaId },
    data: { fundadoraDesde: new Date(), fundadoraDia: dia },
  });
}
```

- **El día** es el que tenga menos fundadoras, la misma regla de «+ Agregar fundadora» (`fundadoras.service.ts:120-124`). Conviene que las dos usen este ayudante.
- **Agrega el mismo candado al «+ Agregar fundadora»** del panel. Así el panel y el registro no se pisan, aunque ese ya use una transacción serializable.
- **Si el Equipo quita una fundadora,** su lugar lo toma la próxima tienda que se registre o la que el Equipo agregue a mano. No se llena solo con una tienda vieja.

## Pruebas

- **e2e, migración:** con 7 tiendas activas sin fundadora, después de migrar `GET /inicio` devuelve `fundadoras.entraron = 7`, `total = 15` y 7 iniciales. Los días van de 1 a 6 y después vuelve el 1.
- **e2e, alta:** con 14 fundadoras, aprobar una solicitud la hace la 15.ª. La 16.ª tienda se crea normal, sin fundadora.
- **e2e, dos altas a la vez con 14:** solo una queda fundadora.

## Versión 1.11.1 en `packages/contracts/src/version.ts`

```ts
{
  version: '1.11.1',
  fecha: 'AAAA-MM-DD',
  publico: ['Ahora son 15 tiendas fundadoras.'],
  equipo: {
    nuevo: [],
    cambia: [
      'Tiendas fundadoras: 15 lugares.',
      'Las tiendas registradas entran como fundadoras, de la más antigua a la más nueva; las nuevas entran solas mientras haya lugar.',
    ],
    arregla: ['La tarjeta del Inicio decía «0 de 10» aunque ya había tiendas registradas.'],
    datos: [],
  },
},
```