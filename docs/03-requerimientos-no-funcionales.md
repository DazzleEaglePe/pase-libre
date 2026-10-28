# 03 · Requerimientos no funcionales

**Versión:** 0.8 (borrador) · **Fecha:** 26/10/2026

## Cómo leer este documento

Los requerimientos no funcionales (RNF) describen **cómo** debe comportarse el sistema, no **qué** hace. Este documento no elige tecnología: eso lo define la [arquitectura](05-arquitectura.md) que arma Dazz.

- **Origen:** **Chat** = dicho por el equipo · **Propuesto** = lo agrega este borrador y hay que validarlo.
- **Meta:** los números marcados *(meta inicial)* son puntos de partida razonables para un producto pequeño. Se ajustan con datos reales.

---

## 1. Usabilidad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-01 | La interfaz debe ser **básica y simple**, pensada para dueños de tiendas (muchos de edad mayor), asesores de ventas y vendedores independientes que no son técnicos | Chat |
| RNF-02 | Debe funcionar **primero en celular** (diseño *mobile-first*), porque la gente busca recorriendo la galería con el teléfono | Propuesto |
| RNF-03 | **Publicar un artículo** debe tomar menos de **2 minutos** y pocos campos obligatorios *(meta inicial)* | Propuesto |
| RNF-04 | Desde la portada, **contactar a un vendedor** debe tomar como máximo **3 toques o clics** | Chat, Propuesto |
| RNF-05 | La interfaz está en **español (Perú)**. Los precios se muestran en **dólares o soles**, según elija el vendedor, con formato local | Chat 24/10, Dazz 25/10 |
| RNF-06 | El diseño usa **categorías grandes y claras** en el lateral izquierdo | Chat |
| RNF-51 | La interfaz sigue la línea gráfica del [lienzo de diseño](https://claude.ai/artifact/H9iqh18AbknFVzzuRZPK1A), página «Línea final» en estructura y escala, con los colores y la tipografía de la línea Hielo (D-52): azul noche #0A1633, azul pase #2F5BFF solo para la acción principal, **Figtree** con pesos 400, 500 y 600 y una sola escala de tamaños (28, 20, 16, 15, 14 y 13 px). Sin íconos en cuadrados de color ni sombras de adorno. En el celular, las acciones principales van en una barra fija abajo | Lienzo 25/10 |
| RNF-55 | En el celular, una **barra inferior** da acceso a las secciones principales (inicio, buscar, mensajes y cuenta) | Lienzo C |
| RNF-07 | Cumple criterios básicos de **accesibilidad**: contraste de al menos 4.5:1, textos legibles, botones táctiles de **al menos 44 px** y controles reales (botones, enlaces y campos con su etiqueta) | Propuesto, lienzo 25/10 |

## 2. Rendimiento

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-08 | La **búsqueda** responde en menos de **1 segundo** para el 95 % de las consultas *(meta inicial)* | Propuesto |
| RNF-09 | La tolerancia a errores de tipeo **no debe degradar** de forma notable el tiempo de respuesta | Chat, Propuesto |
| RNF-10 | La página inicial carga en menos de **3 segundos** en una conexión móvil 4G *(meta inicial)* | Propuesto |
| RNF-11 | Las **imágenes** se optimizan (tamaño y formato) para no consumir datos móviles de más | Propuesto |
| RNF-48 | Los **mensajes del chat** llegan en segundos cuando el destinatario está conectado *(meta inicial: menos de 5 segundos)*. Si no lo está, se genera el aviso (campanita y, después, correo) | Chat 24/10, Propuesto |
| RNF-54 | Las preferencias de avisos se respetan siempre. Con «No molestar», los avisos se guardan y se muestran al terminar el horario | Lienzo C, Propuesto |

## 3. Disponibilidad y confiabilidad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-12 | El sistema está disponible **todos los días en horario comercial de las galerías** como mínimo, con una meta de **99 %** mensual *(meta inicial)* | Propuesto |
| RNF-13 | Se hacen **respaldos automáticos** de la base de datos y de las imágenes, con restauración probada | Propuesto |
| RNF-14 | Si algo falla, el usuario ve **mensajes claros** y no pierde lo que estaba escribiendo al publicar | Propuesto |

## 4. Seguridad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-15 | Toda la comunicación usa **HTTPS** | Propuesto |
| RNF-16 | La **autenticación** es segura (sin contraseñas en texto plano, sesiones con expiración, protección contra intentos repetidos). El acceso es con **correo o usuario y contraseña** | Chat 24/10, Propuesto |
| RNF-17 | Un vendedor **solo puede editar o borrar sus propias** publicaciones | Propuesto |
| RNF-18 | El **precio** nunca se entrega a quien no ha iniciado sesión, ni en la interfaz ni en las respuestas públicas del sistema. A quien sí tiene sesión se le entrega solo si el vendedor lo marcó como visible | Chat, Dazz 25/10 |
| RNF-50 | A quien no ha iniciado sesión el sistema **no le entrega** el nombre de la tienda, el stand ni el WhatsApp del vendedor, ni en pantalla ni en las respuestas públicas | Lienzo 25/10 |
| RNF-19 | Hay **límite de peticiones** y validación de entradas para frenar spam, scraping masivo y ataques comunes (inyección, XSS) | Propuesto |
| RNF-20 | La subida de **imágenes** (publicaciones y chat) valida tipo y tamaño | Propuesto |
| RNF-43 | *(Fase 2, con el registro propio)* Un vendedor nuevo **no puede publicar hasta ser aprobado**, para filtrar bots, personas maliciosas y publicaciones de chiste | Chat 24/10 |

## 5. Privacidad y legal

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-21 | Los **números de WhatsApp** son datos personales: se piden con **consentimiento** y se explica para qué se usan | Propuesto |
| RNF-22 | Se publica una **política de privacidad** y unos **términos de uso** simples. El cumplimiento con la ley peruana de protección de datos personales (Ley 29733) se revisa antes del lanzamiento | Propuesto |
| RNF-23 | Los términos aclaran que PaseLibre **no interviene en las ventas**: el trato es entre vendedores y compradores | Chat |
| RNF-24 | Un vendedor puede **pedir que se eliminen** sus datos y publicaciones | Propuesto |
| RNF-44 | Los **mensajes entre usuarios son privados**: el equipo no los lee. Las notificaciones solo muestran un extracto al destinatario | Chat 24/10 |
| RNF-45 | El **perfil privado** oculta de inmediato nombre, dirección y stand de la tienda, sin afectar sus publicaciones. Se puede revertir cuando el vendedor quiera | Chat 24/10 |
| RNF-46 | El **precio preferencial** de un partner o socio solo lo ve quien tiene ese rol y no se filtra en listados ni respuestas públicas | Chat 24/10, Propuesto |
| RNF-53 | Bloquear y denunciar quedan **registrados para moderación**. Un usuario bloqueado no puede escribir ni pedir pases a quien lo bloqueó | Lienzo C, Propuesto |

## 6. Datos y calidad de contenido

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-25 | Las publicaciones tienen **fecha de última actualización** y el sistema permite ocultar las vencidas | Propuesto |
| RNF-26 | El **etiquetado** es consistente (evitar duplicados como «RTX3070» y «RTX 3070») mediante normalización o sugerencias | Chat, Propuesto |
| RNF-27 | La clasificación por etiquetas es **extensible**: se pueden añadir categorías sin cambiar el código | Propuesto |
| RNF-52 | El catálogo **evita duplicados**: al publicar se sugiere el producto existente con la misma tolerancia a errores de la búsqueda, y las ofertas siempre cuelgan de un producto | Lienzo B, Propuesto |

## 7. Escalabilidad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-28 | Debe soportar de forma holgada **cientos de tiendas, con varios asesores cada una, y decenas de miles de publicaciones** *(supuesto inicial, a validar)* | Propuesto |
| RNF-29 | Debe poder **crecer a otras galerías** sin rediseñar el modelo de datos (la galería es un dato, no una constante) | Chat, Prototipo |

## 8. Mantenibilidad y equipo

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-30 | La interfaz se organiza en **módulos independientes** para que Grimm y My puedan trabajarla en paralelo sin pisarse | Chat |
| RNF-31 | El código vive en un **repositorio con control de versiones**, con convenciones y un README para que cualquiera pueda continuarlo | Propuesto |
| RNF-32 | Hay **pruebas automáticas** al menos para la búsqueda, la publicación y el flujo de contacto | Propuesto |
| RNF-33 | Los entornos de **desarrollo y producción** están separados y se pueden desplegar con pocos pasos | Propuesto |

## 9. Costos y restricciones del proyecto

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-34 | El **costo de infraestructura es bajo** y predecible, porque la plataforma es gratuita y la financia Fabrizio | Chat |
| RNF-35 | La solución se diseña para un **equipo pequeño** y con plazo corto: se prefieren herramientas conocidas por el equipo y poco mantenimiento | Chat, Propuesto |
| RNF-36 | La **primera versión** debe salir **antes de Halloween (31/10)**. El alcance se recorta para cumplirlo | Chat, Dazz 25/10 |
| RNF-37 | **No se almacenan pagos ni datos financieros** | Chat |

## 10. Observabilidad y operación

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-38 | Se registran **errores y eventos clave** (publicaciones, búsquedas, clics en «Contactar») para diagnosticar y medir uso | Propuesto |
| RNF-39 | Hay **alertas** básicas si el sistema se cae | Propuesto |

## 11. Compatibilidad

| ID | Requerimiento | Origen |
| --- | --- | --- |
| RNF-40 | Funciona en las **versiones recientes** de Chrome, Safari y Edge, en Android, iOS y computadora | Propuesto |
| RNF-41 | El botón «Contactar» abre **WhatsApp** (app o Web) según el dispositivo | Chat |
| RNF-42 | El **catálogo público** es **indexable por buscadores** y se puede compartir con vista previa (SEO básico), sin exponer el precio ni los datos de la tienda. Es el medio para que quien busca un producto encuentre la plataforma | Dazz y lienzo 25/10 |
| RNF-47 | Se hace **primero la web y después la app**. La cuenta y los datos son los mismos en ambas: no hay que registrarse dos veces | Chat 24/10 (My, Fabrizio), Dazz 25/10 |

---

## Nota para la arquitectura

En el chat Grimm mencionó que la búsqueda tolerante a errores se resuelve con «consultas SQL nomás». Es una pista, no una decisión. La arquitectura debe confirmar si una base relacional con búsqueda de texto y similitud alcanza para RNF-08, RNF-09 y RNF-13, o si hace falta un buscador dedicado. Con las metas de escala de RNF-28, lo más probable es que una solución simple sea suficiente.

**Chat y notificaciones.** El chat entra dentro de la web (RF-22), así que la arquitectura necesita comunicación en tiempo real (RNF-48). Como es una página y no una app, Grimm señala que el aviso solo llega si el usuario está en la plataforma o revisa su correo. Hay que decidir entre campanita, correo y notificaciones push web para la primera salida, sabiendo que la app llegará después (RNF-47).
