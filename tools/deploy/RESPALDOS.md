# Respaldos y restauración

Cumple RNF-13 y docs/05 §10: respaldo diario de la base, copia de las fotos fuera del servidor y restauración probada. Los scripts vienen de los de Yallegó, adaptados a PaseLibre.

## Qué hay

| Archivo | Para qué |
| --- | --- |
| [`scripts/respaldar.sh`](scripts/respaldar.sh) | Respalda la base en formato custom de `pg_dump`, guarda 7 diarios y 4 semanales y, con `RCLONE_DESTINO`, copia los respaldos y las fotos a B2 |
| [`scripts/ensayar-restauracion.sh`](scripts/ensayar-restauracion.sh) | Restaura el último respaldo en una base aparte (`paselibre_ensayo`), la compara con la de la aplicación y revisa que existan todas las fotos. No toca la base de la aplicación |
| [`scripts/restaurar.sh`](scripts/restaurar.sh) | Restaura un respaldo sobre la base de la aplicación. Se niega si la base ya tiene cuentas, salvo con `--force` |
| [`respaldo.env.example`](respaldo.env.example) | Variables de los tres scripts. Se copia fuera del repositorio |
| [`cron/paselibre-respaldo`](cron/paselibre-respaldo) | Respaldo todos los días a las 03:00 de Lima y ensayo de restauración los domingos |

Los scripts corren `pg_dump` y `pg_restore` dentro del contenedor de Postgres: el servidor no necesita tenerlos instalados.

## Respaldo

```bash
./tools/deploy/scripts/respaldar.sh /opt/paselibre/config/respaldo.env
```

- **Nombre:** cada respaldo se llama `paselibre-<entorno>-<fecha UTC>.dump`.
- **Sin archivos a medias:** se escribe con un nombre temporal, se valida con `pg_restore --list` y recién entonces se publica.
- **Semanales:** el de los domingos queda también en `semanales/`, como enlace duro, así que no ocupa el doble.
- **Fuera del servidor:** con `RCLONE_DESTINO` (por ejemplo `b2:paselibre-respaldos`), la carpeta de respaldos se espeja en B2 y las fotos se copian sin borrar nunca nada allá; cada foto tiene un nombre único que no se reutiliza. Sin `RCLONE_DESTINO` el respaldo avisa que no hay copia externa: un respaldo que vive en el mismo disco que la base no protege si se pierde el servidor.

## Ensayo de restauración

```bash
./tools/deploy/scripts/ensayar-restauracion.sh /opt/paselibre/config/respaldo.env
```

Restaura en `paselibre_ensayo`, compara las migraciones y las filas de las tablas principales con la base de la aplicación, revisa que existan en `MEDIA_DIR` todas las fotos que usa la base y borra la base de ensayo. Termina con error si el respaldo es de otra versión o faltan fotos. Con `--conservar` deja la base de ensayo para revisarla a mano.

## Restaurar de verdad

```bash
# Servidor nuevo, base vacía (después de correr las migraciones o sin ellas)
./tools/deploy/scripts/restaurar.sh respaldo.env /var/backups/paselibre/diarios/paselibre-produccion-20261031T080000Z.dump

# Sobre una base con datos: respaldar primero el estado actual
./tools/deploy/scripts/respaldar.sh respaldo.env
./tools/deploy/scripts/restaurar.sh respaldo.env <respaldo.dump> --force
```

`--clean --if-exists --single-transaction`: la base queda exactamente como el respaldo, sin mezclarse con lo que había, y si algo falla no cambia nada. Después hay que revisar `GET /v1/salud/lista` y entrar con una cuenta de prueba.

Para las fotos, si se perdió el disco: `rclone copy b2:paselibre-respaldos/media /var/lib/paselibre/media`.

## Probado en local (27/10/2026)

Contra el Postgres de desarrollo (`tools/docker/compose.dev.yml`):

- **Respaldo:** diario y semanal; con 9 diarios en la carpeta quedaron los 7 más nuevos.
- **Ensayo de restauración:** restauró en una base aparte, las 8 tablas coincidieron, no faltaba ninguna de las 3 fotos en uso y la base de ensayo se borró al terminar.
- **Restaurar sobre la base de desarrollo:** se negó, porque ya tenía 8 cuentas.
- **Restaurar sobre una base vacía:** funcionó.
- **Restaurar de nuevo con `--force`:** la base volvió exactamente al estado del respaldo; la tabla que se había vaciado volvió a tener sus 28 filas.

**Falta, porque depende del servidor:**

- Configurar `RCLONE_DESTINO` con la cuenta de B2.
- Instalar el cron.
- Hacer el ensayo completo en *staging* con el volumen de fotos real antes de salir (docs/05 §10).
