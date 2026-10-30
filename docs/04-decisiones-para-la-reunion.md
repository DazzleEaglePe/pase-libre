# 04 · Decisiones y pendientes

**Versión:** 0.6 · **Fecha:** 26/10/2026
Lista de lo que ya se decidió y de lo que falta para armar la arquitectura y la interfaz. Las recomendaciones son de este borrador y se basan en lo que el equipo dijo en el chat: son una propuesta.

**Contexto de plazo:** hoy es domingo 25/10. Halloween (sábado 31/10) queda a seis días.
**Diseño:** el [lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A) tiene la versión A, la versión B (eBay y Mercado Libre), cuenta, mensajes y configuración (con ideas de AliExpress) y la **línea final**, con las 13 pantallas de la primera salida y el mapa de rutas. Es privado hasta que se comparta.

---

## Ya decidido (25 y 26/10)

Lo respondió Dazz o salió del lienzo de diseño. Falta validarlo con el equipo.

| Tema | Decisión | Qué implica |
| --- | --- | --- |
| **Plazo** | Salir **antes de Halloween** (D-24) | El alcance es ajustado (ver recortes más abajo) |
| **Catálogo** | **Público**, pero **sin precio** para quien no ha iniciado sesión (D-27) | El precio solo sale con sesión (RNF-18) |
| **Qué ve el visitante** | Foto, título, categoría, estado, stock y galería. **Sin precio, tienda, stand ni contacto** (D-34) | El servidor no entrega esos datos sin sesión (RNF-50) |
| **Registro** | **No hay registro propio por ahora.** El equipo entrega las cuentas. «Crear cuenta» muestra un aviso de mantenimiento (D-29) | No hace falta construir registro ni aprobación en la primera salida |
| **Inicio de sesión** | **Correo o usuario y contraseña** (D-13). Las contraseñas olvidadas las resuelve el equipo | Fabrizio aún no lo confirmó |
| **Productos y ofertas** | **Un producto, varias ofertas:** la ficha muestra «Otras ofertas de este producto», de menor a mayor precio (D-43) | Es la decisión que más pesa en la arquitectura: el catálogo de productos va separado de las ofertas |
| **Publicar** | El vendedor configura el precio (visible u oculto, **oculto por defecto**, en dólares o soles) y puede usar **«Publicar uno igual»** (D-22, D-26, D-44) | Al publicar se sugiere el producto existente |
| **Mensajes** | Chat de la web con **filtros, respuestas rápidas, fotos, archivar, bloquear y denunciar**. Reemplaza al chat de la versión A. Sin archivos (D-30, D-45) | Hace falta comunicación en tiempo real |
| **Configuración** | **Datos de la cuenta, cambio de contraseña y avisos** con «No molestar» (D-46) | El aviso por correo sigue en la fase 2 |
| **«Vendido»** | Se marca **desde el chat** en la primera salida (D-40, D-48) | Pedir pase lo reemplaza en la fase 2 |
| **Web o app** | **Primero la web**, después la app con la misma cuenta (D-21) | La cuenta y los datos deben poder reutilizarse en la app |
| **Galerías** | Filtro por galería desde el inicio, con **piloto** de vendedores conocidos. Maxiplaza es una galería (D-28, D-33) | |
| **Fase 2** | Pedir pase con bandeja, preguntas públicas, reputación, favoritos y seguir tiendas, tienda pública, página de notificaciones, sesiones abiertas, respuesta automática, publicar paso a paso, precio por rol y requerimientos, hoy «En vivo» (D-31, D-47, D-53) | El modelo de datos puede dejarlos previstos |
| **Stack** | El de Yallegó: monorepo pnpm con Next.js, NestJS, Prisma, PostgreSQL, Redis y socket.io (D-50) | Detalle y plan día por día en el [documento 05](05-arquitectura.md) |
| **Línea gráfica** | **Hielo:** azul noche, azul pase y grises fríos (D-52) | Elegida entre 4 propuestas; los archivos están en `branding/` |
| **Bandeja de mensajes** | **Por persona:** cada conversación es entre quien escribe y quien publicó la oferta (D-51) | El equipo puede pasar ofertas y conversaciones de un usuario a otro de la misma tienda |
| **Tipografía** | **Figtree** en toda la interfaz, con una sola escala (D-49, D-52) | Reemplaza a Inter (D-49) y antes a Space Grotesk y Plus Jakarta Sans |

## Pendiente de decidir

| # | Decisión | Recomendación | Por qué |
| --- | --- | --- | --- |
| 1 | **Lienzo frente a la maquetación de Grimm** | Revisar el lienzo con Grimm y My antes de construir. Usar la versión B y la página de cuenta y mensajes como base, y conservar lo que ya resuelva la maquetación de Grimm | Evita retrabajo (R-16). El plazo no deja rehacer la interfaz dos veces |
| 2 | **Duplicados del catálogo** | El sistema sugiere el producto existente al publicar y el equipo une los duplicados | Sin esto, las ofertas no se agrupan (R-17) |
| 3 | **Perfil privado: ¿primera salida o segunda fase?** | **Segunda fase** | Como el visitante ya no ve la tienda (D-34), la urgencia baja |
| 4 | **Piloto y carga inicial** | Fabrizio define **5 a 10 vendedores** y el equipo carga su stock para que el día de salida haya productos | Un catálogo vacío no atrae a nadie |
| 5 | **Slogan** | «Lo que a tu tienda le falta, otra en Wilson ya lo tiene.» | Explica el «pase» sin jerga. «Busca tu wbada» del boceto parece provisional |
| 6 | **Datos que faltan** | Conseguir el WhatsApp de PaseLibre y fotos reales de productos del piloto | Aparecen como marcadores en el lienzo |
| 7 | **Servidor y dominio** | Un VPS nuevo y chico; Dazz lo decide antes del despliegue. Comprar el dominio esta semana | Yallegó maneja pagos y conviene no compartir máquina con un sitio público nuevo |
| 8 | **Maquetación de Grimm** | Preguntarle si es código (React o HTML) o un diseño, para saber qué se reutiliza | Define si sus piezas pasan al código o quedan como referencia visual |

## Confirmaciones rápidas (sí o no)

| Punto | Propuesta |
| --- | --- |
| Inicio de sesión con **correo o usuario y contraseña** | Fabrizio lo confirma |
| Botón **«Vendido»** entra solo **si hay tiempo** | Si no, el vendedor ajusta la cantidad a mano |
| Aviso de publicaciones **sin actualizar en 7 días** | Confirmar el plazo |

## Para llegar a Halloween

**Qué entra en la primera salida:**
- **Catálogo público sin precio ni datos de la tienda**, con buscador tolerante a errores y filtros por categoría y galería.
- **Iniciar sesión** (y «Crear cuenta» en mantenimiento), con cuentas que crea el equipo.
- **Productos con varias ofertas** y **«Publicar uno igual»**.
- Publicar con **stock** y precio visible u oculto, en dólares o soles.
- Ficha con **«Enviar mensaje»** y **«WhatsApp»**.
- **Mensajes** con filtros, respuestas rápidas, fotos y campanita.
- **Configuración**: datos de la cuenta, contraseña y avisos.

**Lo que no se recorta:** el modelo de productos y ofertas. Cambiarlo después obliga a migrar todo el catálogo, aunque la interfaz salga simplificada.

**Si falta tiempo, recortar en este orden:**
1. Botón «Vendido» desde el chat (el vendedor ajusta la cantidad a mano).
2. Acciones de conversación menos usadas: silenciar y marcar como no leído. Bloquear y denunciar se quedan.
3. Filtros finos (por ejemplo, rango de precio).
4. Etiquetas libres: dejar solo categorías y marca o modelo.
5. Fotos en el chat: dejar solo texto.
6. «Publicar uno igual» desde la ficha. Se mantiene la sugerencia del producto existente al publicar.

**Plan B:** si hacia el **29/10** el chat no está estable, se sale con el catálogo y el botón de WhatsApp, y el chat se añade la semana siguiente. La salida no se retrasa por el chat.

**Pasa a la fase 2:** registro propio y aprobación, aviso por correo, precio por rol, perfil privado, cuentas de asesores con planes, requerimientos (hoy «En vivo», D-53), pedir pase con bandeja, preguntas públicas, reputación, favoritos y seguir tiendas, tienda pública, página de notificaciones, sesiones abiertas, respuesta automática, publicar paso a paso y la app.

## Quién hace qué
- **Dazz:** arquitectura ([documento 05](05-arquitectura.md)) y desarrollo, empezando por el modelo de productos y ofertas.
- **Grimm y My:** interfaz, a partir del lienzo y de la maquetación aprobada.
- **Fabrizio:** captación de vendedores y stock inicial.
- **Sin fecha:** porcentajes, planes y precios. No hace falta cerrarlos para empezar.
