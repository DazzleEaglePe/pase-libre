-- doc 20b: las tiendas que ya estaban registradas entran como fundadoras, de la más antigua a la
-- más nueva, hasta llenar los 15 lugares. «Tienda fundadora desde» es cuándo se registró, y los
-- días destacados se reparten de lunes a sábado (después el Equipo los cambia en el panel).
WITH elegidas AS (
  SELECT id, row_number() OVER (ORDER BY creada_en, nombre) AS n
  FROM tienda
  WHERE estado = 'ACTIVA' AND fundadora_desde IS NULL
  ORDER BY creada_en, nombre
  LIMIT GREATEST(0, 15 - (SELECT count(*) FROM tienda WHERE fundadora_desde IS NOT NULL))
)
UPDATE tienda t
SET fundadora_desde = t.creada_en,
    fundadora_dia   = ((e.n - 1) % 6) + 1
FROM elegidas e
WHERE t.id = e.id;
