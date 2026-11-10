-- Primer ingreso, estilo B (OB_WebB, OB_CelB): las cuatro pantallas de bienvenida se ven una
-- sola vez. Nula = todavía no la vio (también las cuentas que ya existían).
ALTER TABLE "usuario" ADD COLUMN "bienvenida_vista_en" TIMESTAMPTZ(6);
