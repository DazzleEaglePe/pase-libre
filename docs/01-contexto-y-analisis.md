# 01 · Contexto y análisis

**Versión:** 0.9 (borrador) · **Fecha:** 29/10/2026
**Fuente:** chat del grupo de WhatsApp «PaseLibre compra y ventas» (22–24/10/2026), incluida la conversación del 24/10 entre las 12:07 y las 23:44, las respuestas de Dazz del 25/10, el [lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A) del 25/10 (versiones A, B, C y la línea final), el boceto que compartió Fabrizio y una captura del prototipo «TechGallery». Lo que no sale del chat está marcado como *propuesto* o *por validar*.

---

## 1. Origen del proyecto

| Fecha | Qué pasó |
| --- | --- |
| Jue 22/10 | Fabrizio crea el grupo y explica la idea. Se acuerda pagar Claude ese día para trabajar |
| Jue 22/10, tarde | Fabrizio propone cambios: se descarta el chat interno, aparece el botón «Contactar», el precio oculto y la búsqueda tolerante a errores. Comparte un boceto |
| Jue 22/10, 17:30 | Grimm comparte un prototipo, «TechGallery», con una captura. Fabrizio dice que le gusta poder buscar por galería |
| Vie 23/10, 11:15 | Dazz le pide a Grimm cuatro documentos en markdown (README, contexto y análisis, requerimientos funcionales y no funcionales) hechos con Claude, **sin diseño ni desarrollo todavía**. Con eso armará la arquitectura y empezará el desarrollo |
| Vie 23/10 | Se propone una reunión de todo el equipo por la noche |
| Sáb 24/10, 9:56 | Dazz le pide a Grimm que comparta su chat de Claude para tener el contexto. Grimm responde que no pudo avanzar y que se quedó con su maquetación, que Fabrizio quiere «tal cual». Estos documentos son esa entrega |
| Sáb 24/10, 12:07–13:40 | Dazz lleva preguntas abiertas al grupo y el equipo responde: quién usa la plataforma, alta con aprobación, inicio de sesión, cuentas de asesores, precios por rol, perfil privado, chat y notificaciones (ver D-10 a D-23) |
| Sáb 24/10, 17:34–23:44 | My propone web y app con la misma cuenta. Fabrizio convoca una reunión para el **25/10 a las 12:00** |
| Dom 25/10 | Dazz responde a la lista de decisiones: salir antes de Halloween, chat dentro de la web, primero la web y después la app, y precio visible u oculto a elección del vendedor (D-17, D-21 y D-24 a D-26). Falta confirmarlo con el equipo |
| Dom 25/10, más tarde | Dazz detalla el resto: catálogo público sin precio al estilo eBay, sin registro propio por ahora, chat con texto y fotos, moneda a elección del vendedor y botón «Vendido» con descuento de stock (D-27 a D-33). Falta confirmarlo con el equipo |
| Dom 25/10, noche | Se recorre eBay como referencia y se arma el lienzo de diseño con el mapa de flujos y 12 pantallas. Dazz aprueba pasar sus decisiones a estos documentos (D-34 a D-42). Falta validarlas con el equipo |
| Dom 25/10, cierre | Se recorren Mercado Libre, eBay y AliExpress y se arman la versión B (ofertas del mismo producto, preguntas, pedir pase, reputación, publicar uno igual) y la página de cuenta, mensajes y configuración. Dazz acepta la recomendación de qué entra en la primera salida (D-43 a D-48) |

## 2. Contexto de negocio

- **Zona:** Galería Wilson y otras galerías tecnológicas del Centro de Lima. En el boceto aparecen *Maxiplaza* y *Cyberplaza* como ejemplos de galería, cada una con tiendas y **stands** numerados.
- **Rubro:** componentes de PC y periféricos: gráficas, procesadores, placas, cases, monitores, RAM.
- **Jerga del rubro:** cuando una tienda necesita algo que no tiene, pide un **«pase»** o un **«libre»**. Es decir, otra tienda le consigue o le cede el producto.
- **Precio de pase:** es el precio al que una tienda cede un producto a otra. Se cotiza en **dólares** y **varía según la relación**: según Fabrizio, una tienda puede dar 240 USD al público general y 234 USD a una tienda amiga.
- **Relaciones entre tiendas:** algunos dueños tienen varias tiendas, son amigos y se hacen pases entre ellos. Según el producto, a veces se lo venden a otras tiendas.
- **Vendedores independientes:** gente **sin tienda propia** que trae productos del exterior por unidad o en pequeñas cantidades y se los vende a tiendas grandes (Fabrizio cita tiendas como CGS o las de la galería Maxiplaza). Suelen tener **buenos precios**. Fabrizio conoce a tres, con uno de ellos ya tiene su stock listo y cree que hay más. Uno de los tres ya abrió tienda.
- **Asesores de ventas (los «chacales»):** empleados de las tiendas que **cierran ventas** y necesitan saber quién tiene el producto más barato. Fabrizio fue uno el año pasado: una tienda les daba pases a nombre de otra persona y así cerraban la venta, con el jefe enterado. Son quienes más usarían la plataforma a diario.
- **Los dueños:** según Fabrizio, la mayoría son «señorones o señoronas del ayer». Un joven del equipo de la tienda es quien ve el valor de la página y se la enseña a los dueños.
- **Discreción:** el rubro guarda sus fuentes y precios como secreto. Fabrizio lo ilustra con la importación: los jóvenes que importaban no supieron mantener el secreto, y hoy hasta el dueño de una tienda grande aparece con varias cuentas de Amazon.

## 3. Problema actual (as-is)

1. La tienda no tiene el producto que pide el cliente.
2. Lo busca en la web y se contacta con otra tienda para pedir el pase.
3. A veces la otra tienda **no se toma la molestia** y el pase no se concreta.
4. A veces se hace presencial: una persona **sube con su celular** recorriendo la galería para ver quién tiene el producto.
5. Las tiendas grandes que abastecen a casi toda Wilson son **muy celosas con su inventario y sus precios**. Fabrizio da el ejemplo de CPP, que hizo ir a una persona en persona a comprar. Solo dan el precio del día si les preguntas por un producto concreto.
6. El precio de pase **cambia según quién lo pide**, y hoy eso solo se sabe de boca en boca.

**Consecuencia:** se pierde tiempo y ventas, y no hay un lugar común donde ver quién tiene qué.

## 4. Propuesta (to-be)

Una interfaz web tipo marketplace/OLX, simple, donde:

- Los **dueños de tienda y sus asesores** publican lo que tienen, de forma gratuita, con cuentas que entrega el equipo. Por ahora no hay registro propio (D-29).
- **Cualquier persona** puede ver el catálogo de productos que se ofrecen para pase, con una interfaz inspirada en eBay: foto, título, categoría, estado, stock y galería, **sin precio, sin nombre de tienda ni stand** (D-27, D-34). Los vendedores con sesión **buscan y filtran** por categoría y por galería, aunque escriban mal.
- El contacto exige iniciar sesión y es por un **chat dentro de la web** (texto y fotos, con campanita de aviso) y por el **botón de WhatsApp** (D-17, D-30).
- El **precio** lo configura el vendedor: visible u oculto, **oculto por defecto**, y en dólares o soles (D-22, D-26). Quien no ha iniciado sesión **nunca** lo ve. Más adelante el vendedor podrá fijar un **precio distinto para sus socios** (D-16).
- Cada producto tiene **stock**. El vendedor marca **«Vendido»** desde el chat y se descuenta una unidad (D-32).
- Cada tienda podrá **ocultar su identidad** (nombre, dirección, stand) sin dejar de publicar, con un perfil privado o público (D-20).
- Un mismo **producto agrupa las ofertas** de varios vendedores, de menor a mayor precio, y cualquiera puede **«Publicar uno igual»** desde una ficha (D-43, D-44).
- **Mensajes** con filtros, respuestas rápidas y acciones de conversación, y una **configuración** básica de la cuenta (D-45, D-46).
- *(Fase 2)* Pedir pase con bandeja, preguntas públicas, reputación, favoritos, tienda pública y **En vivo**: busco y ofertas flash, con «¡Lo tengo!» y «¡Lo quiero!» (D-31, D-47, D-53).

## 5. Fuera de alcance y límites (decisiones explícitas)

- **No se tercerizan las ventas:** solo se publica para que se contacten. No es «Mercado Libre».
- **Chat interno: sí entra**, dentro de la web y junto al botón de WhatsApp. Se había descartado el 22/10 por velocidad; el 24/10 Fabrizio lo reconsideró y el 25/10 Dazz lo confirmó (ver D-02 y D-17).
- **No hay app todavía:** primero la web; la app llega después con la misma cuenta (D-21).
- **No hay registro propio por ahora:** el botón «Crear cuenta» muestra un aviso de mantenimiento (D-29).
- **No es un marketplace de todo:** el foco es Wilson y hardware de PC.
- **No es para el público general:** Fabrizio respondió «a tienda nomas y a independientes» (D-10).

## 6. Actores

| Actor | Descripción | Estado |
| --- | --- | --- |
| **Tienda vendedora** | Publica productos, decide si muestra el precio | Confirmado |
| **Vendedor independiente** | Persona sin tienda que importa por unidad o en pequeñas cantidades y vende a tiendas. Publica igual que una tienda | Confirmado (Fabrizio, 24/10) |
| **Dueño / administrador de tienda** | Gestiona la cuenta de su tienda y, más adelante, las cuentas de sus asesores | Propuesto por Dazz; en el MVP las cuentas las crea el equipo (D-15) |
| **Asesor de ventas** | Empleado de una tienda. Inicia sesión, publica y busca, pero **no puede crear usuarios** | Confirmado (Dazz y Fabrizio, 24/10) |
| **Tienda compradora** | Busca un pase, contacta al vendedor | Confirmado |
| **Visitante (sin sesión)** | Cualquier persona que entra al sitio. Ve el catálogo con foto, título, categoría, estado, stock y galería, **sin precio, sin nombre de tienda ni stand**, y no puede contactar. Sirve para atraer a quien busca un producto | Confirmado (Dazz, 25/10; detalle en D-34) |
| **Administrador de la plataforma** | Crea y entrega las cuentas al inicio, ayuda a registrar vendedores en persona, modera y mide uso (hoy sería el equipo y Fabrizio). Aprobar registros propios queda para cuando se abra | Confirmado (Fabrizio, 24/10; Dazz, 25/10) |

## 7. Equipo, roles y modelo de negocio

**Roles:** ver la tabla del [README](../README.md#equipo-y-roles).

**Modelo (provisional):**
- La plataforma se **ofrece gratis** al inicio; Fabrizio la ofrece a las tiendas «en persona».
- Fabrizio **financia** lo que se necesite y **negocia**.
- El resto del equipo pone la mano de obra. **Si funciona**, se negocian porcentajes. No hay porcentajes definidos todavía.
- **Idea nueva (24/10):** Dazz propuso que el **número de asesores por tienda dependa del plan contratado**: más asesores, plan mayor y de mayor precio. Fabrizio: «esa es una buena idea». No hay planes ni precios definidos.
- **Plazo deseado:** Halloween o Navidad.

## 8. Decisiones tomadas

| ID | Fecha | Decisión | Motivo y estado |
| --- | --- | --- | --- |
| D-01 | 22/10 | Es un marketplace básico, **sin intermediar ventas** | Mantenerlo simple y evitar pagos, envíos y disputas |
| D-02 | 22/10 | Se descartó el chat interno | Es lento: el comprador tendría que chatear primero para pedir el número. **Revisada el 24/10** (ver D-17) |
| D-03 | 22/10 | Botón **«Contactar»** que abre WhatsApp con el mensaje «Vi que tienes (artículo) publicado en PaseLibre, ¿a qué precio lo tienes?» | Contacto más rápido, sin pasos extra |
| D-04 | 22/10 | **Precio «Al interno»** (oculto) como opción | Las tiendas grandes no quieren publicar precio ni inventario |
| D-05 | 22/10 | Foco **100 % Wilson y componentes/periféricos de PC** | Permite un diseño con categorías grandes en vez de un «catálogo de todo» |
| D-06 | 22/10 | Menú lateral izquierdo con categorías (Gráficas, Procesadores, Placas, Cases, Monitores…) y clasificación por **etiquetas** | Se compensa con búsquedas y publicaciones más completas |
| D-07 | 22/10 | **Búsqueda tolerante a errores** de tipeo | Un dígito mal escrito no debe dar «cero resultados» (ver §10) |
| D-08 | 22/10 | **Buscar por separado en cada galería** | Fabrizio lo destacó del prototipo TechGallery |
| D-09 | 23/10 | Primero se documenta; luego Dazz arma la arquitectura y empieza el desarrollo | Orden de trabajo |
| D-10 | 24/10 | Los **vendedores son tiendas e independientes**. El público general no es usuario: solo puede mirar el catálogo sin precio (D-27) | Fabrizio: «a tienda nomas y a independientes» |
| D-11 | 24/10 | El alta es por **registro con aprobación del administrador** antes de poder publicar | Grimm: así «filtramos a los bots o personas maliciosas». **Confirmada por Fabrizio.** El 25/10 Dazz la pasó a la fase 2, porque por ahora no hay registro propio (D-29) |
| D-12 | 24/10 | **Registro asistido:** Fabrizio visita las tiendas y las ayuda a registrarse en persona | Fabrizio lo compara con lo que hizo Mercado Libre el año pasado |
| D-13 | 25/10 | **Inicio de sesión con correo o usuario y contraseña** | Propuesta de Grimm: «manteniéndolo simple para el usuario». Dazz lo confirmó el 25/10. Fabrizio no se pronunció |
| D-14 | 24/10 | Mientras la cuenta no está aprobada, el usuario puede entrar y ve una pantalla **«Tu cuenta está en proceso de aprobación»** | Fabrizio, retomando una idea de Grimm |
| D-15 | 24/10 | **En el MVP el equipo crea los usuarios** y se los entrega, con gente conocida para la demo. Los **roles y permisos** vienen después. Más adelante, el dueño o administrador de la tienda gestiona las cuentas de sus asesores, que no pueden crear usuarios, con un límite según el plan | Grimm: los permisos por rol son «más chamba». Dazz: «lo podemos mejorar más adelante». My: «va, queda así» |
| D-16 | 24/10 | **Precio por rol:** un precio general y uno preferencial para quienes el vendedor marque como **partner o socio**, a la manera de los roles de Discord (ej. 250 USD general, 245 USD partner) | Replica cómo se manejan hoy los pases. Aprobada en concepto por My, Grimm y Fabrizio. **Sin fecha** |
| D-17 | 25/10 | **Chat dentro de la web, además del botón de WhatsApp.** Fabrizio lo propuso el 24/10 para consultas sin compromiso (por ejemplo, un domingo, antes de cerrar con el cliente) | **Decidido por Dazz el 25/10**, por confirmar con el equipo. Grimm advierte que el vendedor solo vería el mensaje si está conectado, por eso hacen falta avisos (D-18) |
| D-18 | 24/10 | **Notificaciones** de mensajes: campanita dentro de la plataforma y **correo**, con un extracto del mensaje | Propuesta de Fabrizio y Grimm. Grimm sugiere vincular el correo con Google. **Necesaria si hay chat.** Falta definir si la primera salida lleva solo campanita o también correo |
| D-19 | 24/10 | El equipo **no lee los mensajes** de los usuarios | Grimm: técnicamente se podría, pero «sería violación de privacidad» y no aporta |
| D-20 | 24/10 | **Perfil privado:** cada tienda puede ocultar su nombre, dirección y stand y volver a mostrarlos cuando quiera, «a lo TikTok» | Fabrizio y My. Aprobada por todos |
| D-21 | 25/10 | **Primero la web y después la app**, con la misma cuenta y la misma información, como Mercado Libre | Propuesta de My y Fabrizio el 24/10. **Dazz fijó el orden el 25/10:** web primero |
| D-22 | 25/10 | Los precios pueden ser en **dólares o soles**, a elección del vendedor | Los ejemplos de Fabrizio son en USD. Dazz aclaró el 25/10 que la moneda también la configura el vendedor |
| D-23 | 24/10 | Se mantiene la **maquetación de Grimm «tal cual»** | Fabrizio la quiere así, según Grimm |
| D-24 | 25/10 | La meta es **salir antes de Halloween (31/10)** | Dazz. Con el chat dentro, el alcance es ajustado (ver R-11 y el documento 04) |
| D-25 | 25/10 | El **producto siempre es visible**, también para quien no ha iniciado sesión. El precio no | Dazz: «los precios no se ven al publicar en general, pero sí los productos» |
| D-26 | 25/10 | El **precio es configurable por el vendedor**: visible o no visible, **oculto por defecto** (se muestra «Al interno» y se consulta por chat o WhatsApp). Quien no ha iniciado sesión **nunca** ve el precio | Dazz. Supuesto: se configura **por publicación**; hay que confirmarlo |
| D-27 | 25/10 | **Catálogo público, sin precio** para quien no ha iniciado sesión, con una interfaz inspirada en **eBay** | Dazz: atraer a quien busca un producto sin dejar que cualquiera vea precios. Faltan las capturas de referencia |
| D-28 | 25/10 | Las **galerías** y el **filtro por galería** existen desde el inicio, y se arranca con un **piloto** de vendedores conocidos | Dazz aceptó. «Piloto» significa empezar con un grupo pequeño; la plataforma ya soporta todas las galerías |
| D-29 | 25/10 | **No hay registro propio por ahora.** El equipo da credenciales a dueños de tienda y asesores. El botón **«Crear cuenta»** muestra un aviso de mantenimiento («pronto podrás crear tu cuenta») | Dazz |
| D-30 | 25/10 | **Alcance del chat:** texto, **fotos** y campanita de aviso. **Sin archivos** | Dazz. El aviso por correo no se mencionó y queda para la fase 2 |
| D-31 | 25/10 | **Precio por rol, requerimientos y datos de verificación de independientes** pasan a la **segunda fase** | Dazz: «definitivamente para la segunda fase» (precio por rol); «ahí lo veremos más adelante» (independientes) |
| D-32 | 25/10 | **Stock y «Vendido»:** cada producto tiene cantidad. Desde el chat, el vendedor pulsa **«Vendido»**, elige a quién se lo vendió entre quienes conversaron con él y se descuenta una unidad. Con cero, el producto queda **sin stock** | Dazz. Además, cada publicación muestra su fecha de última actualización |
| D-33 | 25/10 | **Maxiplaza es una galería** | Dazz, aclarando el chat del 24/10 |
| D-34 | 25/10 | **Lo que ve el visitante:** foto, título, categoría, estado, stock y galería. **No ve** precio, nombre de la tienda, stand ni botones de contacto; en su lugar ve «Precio con sesión» e «Inicia sesión para contactar» | Lienzo de diseño. Protege la identidad de las tiendas sin que haga falta el perfil privado en la primera salida |
| D-35 | 25/10 | **Contactar exige sesión.** En la ficha hay dos botones: **«Enviar mensaje»** (chat de la web, principal) y **«WhatsApp»** | Lienzo de diseño |
| D-36 | 25/10 | **Perfil privado:** se muestra como «Vendedor privado» con su galería; se ocultan nombre y stand y los productos siguen publicados. El perfil enseña «Así te ven otros vendedores» | Lienzo de diseño, a partir de D-20. Falta decidir si entra en la primera salida |
| D-37 | 25/10 | **Valores por defecto al publicar:** la tienda los fija en su perfil (de inicio, precio oculto y US$) y cada publicación puede cambiarlos | Lienzo de diseño. Responde «¿por publicación o por tienda?» |
| D-38 | 25/10 | **Interfaz:** estructura inspirada en eBay con línea gráfica propia: tinta #14161A, acento lima #C8F03C, Space Grotesk para títulos y Plus Jakarta Sans para texto; botones de al menos 44 px | [Lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A). Falta compararlo con la maquetación de Grimm (D-23, R-16) |
| D-39 | 25/10 | **Búsqueda con errores:** si alguien escribe «rtx 3370», se muestra «Mostramos resultados para rtx 3070. Buscaste rtx 3370» y búsquedas relacionadas. El filtro por precio solo aparece con sesión | Lienzo de diseño |
| D-40 | 25/10 | **«Vendido» paso a paso:** en el chat, «Marcar como vendido» abre una ventana para elegir al comprador entre quienes conversaron sobre ese producto, muestra el stock antes y después y deja un aviso en la conversación. Con 0, el producto pasa a «Sin stock» y en «Mis publicaciones» aparece «Reponer stock» | Lienzo de diseño, a partir de D-32 |
| D-41 | 25/10 | **Publicaciones sin actualizar:** «Mis publicaciones» avisa de las que llevan más de 7 días sin cambios | Lienzo de diseño. El plazo de 7 días es una propuesta |
| D-42 | 25/10 | **Panel del equipo:** crea cuentas (tipo, tienda, galería, stand, persona, usuario, correo opcional, WhatsApp y contraseña inicial generada), lista el piloto con su estado («Activa» o «Sin primer ingreso»), reenvía el acceso y carga productos por planilla con los precios ocultos | Lienzo de diseño. Por ahora, las contraseñas olvidadas las resuelve el equipo |
| D-43 | 25/10 | **Producto y oferta son cosas separadas.** El catálogo tiene productos únicos (marca, modelo, categoría, fotos base) y cada vendedor publica su **oferta** sobre uno: precio, moneda, stock y estado. La ficha muestra «Otras ofertas de este producto», de menor a mayor precio | Primera salida. Inspirado en «Otras opciones de compra» de Mercado Libre y en «N vendedores» de AliExpress. Responde a «¿quién lo tiene más barato?» |
| D-44 | 25/10 | **«Publicar uno igual»:** desde una ficha o al escribir el título, se sugiere el producto existente; el vendedor copia fotos y datos y solo pone stock, estado y precio | Primera salida. Inspirado en «Vender uno igual» de Mercado Libre. Ayuda a cargar rápido el piloto |
| D-45 | 25/10 | **Mensajes de la página C reemplaza al chat de la versión A:** lista con filtros (todas, no leídos, archivados) y buscador, producto fijo arriba del chat, respuestas rápidas, fotos, «Visto», y marcar como no leído, silenciar, archivar, bloquear y denunciar | Primera salida. Inspirado en los centros de mensajes de AliExpress y eBay. El filtro «Pedidos» llega con pedir pase |
| D-46 | 25/10 | **Configuración básica:** datos de la cuenta (usuario, galería y stand los cambia el equipo; horario de atención), cambio de contraseña y avisos por tipo con «No molestar», desde un menú de cuenta | Primera salida. El aviso por correo sigue en la fase 2 (RF-42) |
| D-47 | 25/10 | **Pasan a la fase 2:** pedir pase con bandeja (aceptar, separar, concretar), preguntas públicas, reputación, favoritos y seguir tiendas, tienda pública, página de notificaciones, sesiones abiertas, respuesta automática fuera de horario, publicar paso a paso con medidor de calidad e inicio con pendientes | Recomendación aceptada por Dazz |
| D-48 | 25/10 | En la primera salida, **«Vendido» se marca desde el chat** (D-40). Cuando llegue pedir pase, el pase concretado lo reemplaza | Evita tener dos formas de marcar una venta |
| D-49 | 25/10 | **Tipografía y línea final:** toda la interfaz usa **Inter** (400 texto, 500 etiquetas, 600 títulos y botones) con una sola escala (28, 20, 16, 15, 14 y 13 px). El lienzo suma la página «Línea final · todas las pantallas» con el mapa de rutas y las 13 pantallas de la primera salida | Lienzo de diseño. Reemplaza las fuentes de D-38: las referencias (eBay, Mercado Libre, AliExpress) usan una sola familia |
| D-50 | 26/10 | **Stack:** se reutiliza el de Yallegó: monorepo pnpm con Next.js, NestJS, Prisma, PostgreSQL, Redis y socket.io | Dazz. Detalle en el [documento 05](05-arquitectura.md). El servidor (VPS nuevo o el de Yallegó) se decide al final |
| D-51 | 26/10 | **Bandeja de mensajes por persona:** cada conversación es entre quien escribe y el responsable de la oferta (quien la publicó). Los demás usuarios de la tienda no la ven | Dazz. El equipo puede pasar las ofertas y conversaciones de un usuario a otro de la misma tienda |
| D-52 | 27/10 | **Línea gráfica «Hielo»:** azul noche #0A1633 para el texto, azul pase #2F5BFF para actuar y grises fríos; tipografía **Figtree** (400, 500 y 600) con la misma escala de D-49; el logo es la entrada con muesca y la flecha vaciada. Reemplaza el lima, la tinta y Inter de D-49 en el código y los archivos de marca | Dazz, entre 4 propuestas minimalistas (Papel, Hielo, Musgo y Noche) hechas con Claude y con la imagen de ChatGPT. Los archivos están en `branding/` y las propuestas en `branding/propuestas/`. El lienzo de diseño conserva la línea anterior hasta que Grimm y My lo actualicen |
| D-53 | 29/10 | **En vivo: busco y ofertas flash.** Los requerimientos del boceto pasan a ser dos publicaciones que duran unas horas: **«Busco»** (las demás tiendas responden «¡Lo tengo!») y **«Oferta flash»** (responden «¡Lo quiero!»). Cualquier cuenta publica las dos, y la respuesta abre el chat de la web. Se muestran con la **propuesta E** del lienzo: al entrar, una ventana flotante junto al saludo; al bajar, una tarjeta mini en la esquina que pasa una publicación a la vez y sigue al usuario | Dazz, entre las propuestas del lienzo (A a D para la portada; E, F y G para «aparece y te sigue»). Se construyó el mismo 29/10 detrás del interruptor `EN_VIVO` (apagado en producción hasta que se decida encenderlo); el estado está en el [documento 11 §7](11-plan-de-desarrollo.md#7-en-vivo) |

## 9. Preguntas

### 9.1 Cerradas o casi cerradas

| # | Pregunta | Respuesta del equipo |
| --- | --- | --- |
| 1 | ¿Quién usa PaseLibre? | Tiendas, sus asesores e independientes (D-10) |
| 2 | ¿Cómo se dan de alta los vendedores? | Por ahora el equipo da las credenciales y no hay registro propio (D-29, D-15). La ayuda presencial de Fabrizio sigue (D-12) |
| 3 | ¿Cómo inician sesión? | Correo o usuario y contraseña (D-13). Dazz lo confirmó; Fabrizio no se ha pronunciado |
| 4 | ¿Se reutiliza el prototipo TechGallery? | Se mantiene la maquetación de Grimm tal cual (D-23). Su enlace temporal ya no responde |
| 5 | ¿Qué moneda? | Dólares o soles, a elección del vendedor (D-22) |
| 6 | ¿Plazo? | Salir antes de Halloween (D-24). Con el alcance actual es ajustado |
| 7 | ¿Chat interno sí o no? | Sí, dentro de la web y además del botón de WhatsApp (D-17) |
| 8 | ¿Web sola o web y app? | Primero la web, después la app con la misma cuenta (D-21) |
| 9 | ¿Precio visible u oculto? | Configurable por el vendedor, oculto por defecto (D-26) |
| 10 | ¿Quién ve el catálogo? | Todos, pero **sin precio** si no han iniciado sesión (D-27) |
| 11 | ¿Alcance del chat? | Texto, fotos y campanita; sin archivos (D-30) |
| 12 | ¿Autoregistro y aprobación? | No por ahora; fase 2 (D-29) |
| 13 | ¿Precio por rol y requerimientos? | Segunda fase (D-31) |
| 14 | ¿Galerías del lanzamiento? | Filtro por galería desde el inicio y piloto de vendedores conocidos (D-28) |
| 15 | ¿Maxiplaza es galería o tienda? | Galería (D-33) |
| 16 | ¿Stock desactualizado? | Cantidad por producto, fecha de última actualización y botón «Vendido» (D-32) |
| 17 | ¿Qué ve exactamente el visitante? | Foto, título, categoría, estado, stock y galería; sin precio, tienda, stand ni contacto (D-34) |
| 18 | ¿Precio y moneda por publicación o por tienda? | Ambos: la tienda fija valores por defecto y cada publicación los cambia (D-37) |
| 19 | ¿Qué entra de las versiones B y C? | Ofertas del mismo producto, publicar uno igual, mensajes con filtros y respuestas rápidas, y configuración básica (D-43 a D-48) |

### 9.2 Abiertas

Cada una cambia el diseño o el alcance. Conviene cerrar las primeras antes de construir la interfaz.

1. **Lienzo frente a la maquetación de Grimm:** el lienzo (D-38) sigue la estructura de eBay con una línea gráfica propia. ¿Se adopta, se mezcla con la maquetación de Grimm o se ajusta la de Grimm? Conviene verlo con Grimm y My.
2. **Perfil privado:** el diseño ya lo resuelve (D-36). ¿Entra en la primera salida o en la segunda fase?
3. **Qué se recorta para llegar a Halloween.** Ver los recortes propuestos en el documento 04.
4. **Plan B:** si hacia el 29/10 el chat no está listo, ¿se sale con el botón de WhatsApp y el chat se añade después?
5. **Piloto y carga inicial:** ¿qué vendedores forman el piloto? ¿Quién carga sus productos: ellos, el equipo o una planilla?
6. **Aviso por correo:** ¿primera salida o fase 2? No se mencionó el 25/10.
7. **Cuentas por tienda y planes:** ¿cuántos asesores incluye una tienda sin pagar? ¿Cuándo se empieza a cobrar? ¿Cuándo se definen los porcentajes?
8. **Roles de relación (partner/socio):** cómo se otorga el rol a otra tienda (fase 2).
9. **Slogan:** el boceto dice «Busca tu wbada» y el lienzo propone «Lo que a tu tienda le falta, otra en Wilson ya lo tiene.». ¿Cuál queda?
10. **Verificación de independientes:** qué datos se piden. Dazz: «más adelante».
11. **Datos que faltan en el diseño:** el WhatsApp de PaseLibre (para pedir acceso y recuperar la contraseña) y fotos reales de productos.
12. **Duplicados del catálogo:** con productos y ofertas separados (D-43), ¿quién une un producto escrito de dos formas? Propuesta: el sistema sugiere el existente al publicar y el equipo une los duplicados.
13. **Vitrina de una tienda privada:** cuando llegue la tienda pública (fase 2), ¿una tienda con perfil privado no tiene vitrina o muestra una genérica?
14. **Avisos por correo en Configuración:** como el correo es de la fase 2 (RF-42), ¿la primera salida muestra solo la campanita?

## 10. Referencias y competencia

| Referencia | Qué se toma o se evita |
| --- | --- |
| **Mercado Libre** | Se evita vender de todo e intermediar. Se toman «Otras opciones de compra» (ofertas del mismo producto), «Vender uno igual», preguntas públicas, reputación y el registro asistido; web y app con la misma cuenta |
| **eBay** | Referencia de interfaz que pidió Dazz, recorrida el 25/10: buscador con selector de categoría, categorías en mosaico, filtros a la izquierda, búsquedas relacionadas y ficha con galería, tarjeta del vendedor y bloque de acción. Se toma la estructura, no su marca ni sus colores |
| **OLX** | Se toma la idea de publicar y contactar, en versión «básica y chikita» |
| **AliExpress** | Centro de mensajes con el producto fijo arriba del chat, vitrina de tienda con seguidores, «Seguir» y «Contactar ahora», y «N vendedores» en los resultados |
| **Sitio de Memory Kings** | Se evita: Fabrizio considera sus filtros «basura» y su buscador falla con un dígito mal escrito |
| **Buscador de YouTube / Spotify** | Referente de búsqueda: encuentra aunque escribas mal. Ejemplo del chat: se busca «3370» en una tienda y salen mouses; YouTube sí interpreta que se buscaba una RTX 3070 |
| **Roles de Discord** | Referente para los roles de relación (partner, socio) con precio distinto |
| **Perfil privado de TikTok** | Referente para ocultar la identidad de la tienda y volver a mostrarla |
| **Prototipo «TechGallery» (Grimm)** | Interfaz oscura, buscador arriba, categorías a la izquierda, tarjetas de producto y selector de galería. Aprobado: «esa es la idea en sí» y se mantiene tal cual |
| **Boceto de Fabrizio** | Buscador, menú de categorías, banda de **Requerimientos** con botones «Lo tengo!!» y, debajo, tarjetas con precio, vendedor, galería y stand |

## 11. Riesgos y supuestos

| ID | Riesgo / supuesto | Impacto | Mitigación sugerida |
| --- | --- | --- | --- |
| R-01 | Las tiendas grandes no publican por miedo a mostrar inventario o precios | Poco contenido, la plataforma no despega | Precio «Al interno», perfil privado, precio por rol |
| R-02 | Masa crítica: sin suficientes vendedores, nadie vuelve | Abandono | Fabrizio capta vendedores en persona y ayuda con el registro; sembrar el catálogo con el stock que ya tiene listo un independiente |
| R-03 | Stock y precios desactualizados | Pérdida de confianza | Fecha de última actualización, vigencia, recordatorios |
| R-04 | Se quiere mucho para muy poco tiempo (Halloween / Navidad) | Entrega incompleta | Recortar a un MVP mínimo (ver requerimientos *Must*) |
| R-05 | Dependencia de WhatsApp para el contacto | Pérdida de datos de uso | Registrar los clics en «Contactar» para medir valor |
| R-06 | Los números de WhatsApp y los mensajes son datos personales | Riesgo legal y de spam | Consentimiento, política de privacidad y no leer mensajes (ver RNF) |
| R-07 | Estafas o publicaciones falsas | Daño a la reputación | Aprobación previa, reportes y moderación |
| R-08 | La dedicación de cada integrante no está definida | Retrasos | Reparto claro de la interfaz entre Grimm y My |
| R-09 | Los independientes no tienen local fijo: es más difícil saber quiénes son y que cumplan | Estafas, mala reputación | Aprobación previa, datos mínimos de identidad y reportes |
| R-10 | La aprobación manual depende de Fabrizio y puede frenar los registros | Fricción al inicio | Panel simple de aprobación y registro asistido en persona |
| R-11 | **El alcance crece** (chat, notificaciones, roles, planes) y la meta es salir antes de Halloween, a seis días | No se llega a la fecha o sale sin pulir | Recortar según el documento 04 y tener un plan B: salir con WhatsApp y añadir el chat después |
| R-12 | Si el vendedor no está conectado, **no ve los mensajes** del chat | Ventas perdidas, el chat parece que no sirve | Campanita, correo y botón de WhatsApp como alternativa |
| R-13 | **Confidencialidad:** el rubro guarda sus fuentes y precios como secreto | Los vendedores no participan | Perfil privado, precio por rol y no leer mensajes |
| R-14 | Los dueños son personas mayores y los usuarios diarios son los asesores | Baja adopción | Interfaz muy simple y que el asesor joven muestre el valor |
| R-15 | El catálogo es público: si la interfaz o las respuestas del sistema entregan el precio, **cualquiera lo ve** | Se rompe el secreto del rubro | Entregar el precio solo con sesión y desde el servidor (RNF-18) |
| R-16 | Alinearse a eBay puede chocar con la maquetación de Grimm, que Fabrizio quiere «tal cual» | Retrabajo de Grimm y My | Comparar el lienzo (D-38) con la maquetación antes de construir la interfaz |
| R-17 | **Productos duplicados** en el catálogo (el mismo modelo escrito de dos formas) | Las ofertas no se agrupan y la comparación falla | Sugerir el producto existente al publicar y que el equipo pueda unir duplicados |
| R-18 | El alcance de la primera salida creció con ofertas, uno igual, mensajes y configuración | No se llega a Halloween | Mantener los recortes y el plan B del documento 04. El modelo de productos y ofertas se hace bien desde el inicio, aunque la interfaz salga simplificada |
| S-01 | *Supuesto:* los usuarios usan sobre todo el celular, dentro de la galería | Diseño | Diseñar primero para móvil |
| S-02 | *Supuesto:* la plataforma es gratis al inicio | Costos | Infraestructura económica, a cargo de Fabrizio |

## 12. Glosario

| Término | Significado en este proyecto |
| --- | --- |
| **Pase / Libre** | Cuando una tienda necesita un producto que no tiene, se lo pide a otra tienda |
| **Precio de pase** | Precio al que una tienda cede un producto a otra, normalmente en dólares y variable según la relación |
| **Wilson** | Galería Wilson, zona de tiendas de tecnología en el Centro de Lima |
| **Galería / Stand** | Centro comercial y local dentro de él |
| **Maxiplaza, Cyberplaza** | Galerías de la zona de Wilson |
| **Visitante** | Persona sin sesión iniciada. Ve el catálogo sin precio y no puede contactar |
| **Al interno** | Precio que no se muestra públicamente: se pregunta por contacto |
| **Partner / socio** | Rol que un vendedor da a otra tienda para ofrecerle un precio preferencial |
| **Independiente** | Vendedor sin tienda que trae productos del exterior por unidad o en pequeñas cantidades y los vende a tiendas |
| **Asesor / «chacal»** | Empleado de una tienda que cierra ventas y busca quién tiene el producto más barato |
| **En vivo** | Publicación que dura unas horas: un «Busco» o una «Oferta flash» (D-53) |
| **Busco** (antes «requerimiento») | Publicación de una tienda que necesita un producto para un cliente |
| **Oferta flash** | Una publicación a precio de pase solo por hoy |
| **«¡Lo tengo!» / «¡Lo quiero!»** | Respuesta de otra tienda a un busco o a una oferta flash. Abre el chat |
| **wbada / wbear** | Jerga del chat, usada como «cosa» o «equivocarse» según el caso. No es un término técnico |
| **CPP, CGS** | Tiendas grandes de Wilson citadas por Fabrizio. CPP, como ejemplo de vendedor «celoso» |
