import Link from 'next/link';
import type { ReactNode } from 'react';

import { ContactoEquipo, Documento, Seccion } from './documento';

const enlace = 'font-medium underline';

function Pregunta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-linea px-4 py-3 open:bg-superficie">
      <summary className="cursor-pointer list-none text-tarjeta marker:content-none">
        <span className="flex items-center justify-between gap-3">
          {titulo}
          <span aria-hidden className="text-detalle transition-transform group-open:rotate-45">
            +
          </span>
        </span>
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-secundario">{children}</div>
    </details>
  );
}

/** Ayuda: las preguntas que más se repiten, con el camino corto a cada pantalla. */
export function Ayuda() {
  return (
    <Documento
      titulo="Ayuda"
      resumen="Respuestas cortas a lo que más se pregunta. Si no encuentras la tuya, escríbele al equipo."
    >
      <Seccion titulo="Sobre PaseLibre">
        <Pregunta titulo="¿Qué es PaseLibre?">
          <p>
            Un catálogo para que las tiendas de las galerías de Wilson encuentren entre ellas los
            componentes que les faltan y se pasen productos. Publicas lo que tienes y te escriben
            las tiendas que lo necesitan.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Cuánto cuesta?">
          <p>Nada. Publicar, buscar y conversar es gratis.</p>
        </Pregunta>
        <Pregunta titulo="¿PaseLibre interviene en la venta?">
          <p>
            No. El precio, el pago y la entrega los acuerdan entre ustedes. PaseLibre no cobra
            comisiones ni recibe pagos. Más detalle en los{' '}
            <Link href="/terminos" className={enlace}>
              términos de uso
            </Link>
            .
          </p>
        </Pregunta>
      </Seccion>

      <Seccion titulo="Tu cuenta">
        <Pregunta titulo="¿Cómo consigo una cuenta?">
          <p>
            Por ahora las cuentas las crea el equipo de PaseLibre para dueños de tienda, asesores y
            vendedores independientes. Para pedir la tuya,{' '}
            <ContactoEquipo mensaje="Hola, quiero una cuenta en PaseLibre para mi tienda." />.
          </p>
        </Pregunta>
        <Pregunta titulo="Es mi primera vez: ¿qué contraseña uso?">
          <p>
            La primera vez entras con la contraseña temporal que te dio el equipo. Enseguida
            PaseLibre te pide crear la tuya: al menos 8 caracteres y un número.
          </p>
        </Pregunta>
        <Pregunta titulo="Olvidé mi contraseña">
          <p>
            Pídele al equipo una contraseña temporal nueva:{' '}
            <ContactoEquipo mensaje="Hola, olvidé mi contraseña de PaseLibre." />. Con ella entras y
            creas otra.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Cómo cambio mi contraseña o cierro sesión en otro equipo?">
          <p>
            En{' '}
            <Link href="/cuenta/configuracion?seccion=seguridad" className={enlace}>
              Configuración · Seguridad
            </Link>
            . Ahí también ves dónde está abierta tu cuenta y puedes cerrar las demás sesiones.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Puedo borrar mi cuenta?">
          <p>
            Sí. Pídeselo al equipo y se eliminan tus publicaciones y tus datos. La{' '}
            <Link href="/privacidad" className={enlace}>
              política de privacidad
            </Link>{' '}
            explica qué se guarda.
          </p>
        </Pregunta>
      </Seccion>

      <Seccion titulo="Buscar">
        <Pregunta titulo="¿Por qué no veo precios ni el nombre de la tienda?">
          <p>
            Porque no has ingresado. Sin cuenta se ven los productos, su estado, el stock y la
            galería; con cuenta se suman la tienda, el stand y los precios.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Qué quiere decir «Al interno»?">
          <p>
            Que el vendedor prefirió no mostrar el precio. Pregúntaselo con «Enviar mensaje» o por
            WhatsApp desde la publicación.
          </p>
        </Pregunta>
        <Pregunta titulo="Escribí mal el modelo y no aparece">
          <p>
            Busca como te salga: PaseLibre corrige los errores de tipeo más comunes. Si buscas «rtx
            3370», te muestra la RTX 3070 y te avisa. Si aun así no aparece, prueba con menos
            palabras, por ejemplo solo la marca y el modelo.
          </p>
        </Pregunta>
      </Seccion>

      <Seccion titulo="Publicar">
        <Pregunta titulo="¿Cómo publico un producto?">
          <p>
            Entra a{' '}
            <Link href="/publicar" className={enlace}>
              Publicar
            </Link>{' '}
            y escribe qué vas a publicar. Si ya está en PaseLibre, elige «Publicar uno igual» y solo
            completas tu stock y tu precio. Si no está, «¿No está en la lista?» te deja crear el
            producto. Toma un par de minutos.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Tengo que mostrar el precio?">
          <p>
            No. Cada publicación sale con el precio oculto, salvo que elijas mostrarlo. Puedes
            cambiar ese valor y la moneda que aparecen al publicar en{' '}
            <Link href="/cuenta/configuracion?seccion=preferencias" className={enlace}>
              Configuración · Preferencias
            </Link>
            .
          </p>
        </Pregunta>
        <Pregunta titulo="¿Cómo actualizo el stock?">
          <p>
            En{' '}
            <Link href="/mis-publicaciones" className={enlace}>
              Mis publicaciones
            </Link>
            , con − y +. Ahí también pausas, editas o eliminas una publicación. Las que llevan más
            de 7 días sin cambios piden revisión: si siguen igual, confírmalas con «Siguen igual».
          </p>
        </Pregunta>
        <Pregunta titulo="Ya vendí: ¿cómo lo marco?">
          <p>
            Desde la conversación con quien te compró, con el botón «Vendido». Eliges a quién le
            vendiste, el stock baja en uno y queda anotado en el chat.
          </p>
        </Pregunta>
      </Seccion>

      <Seccion titulo="Mensajes">
        <Pregunta titulo="¿Quién ve mis mensajes?">
          <p>Solo tú y la otra persona de la conversación. El equipo de PaseLibre no los lee.</p>
        </Pregunta>
        <Pregunta titulo="Alguien me molesta: ¿cómo lo bloqueo?">
          <p>
            Dentro de la conversación, en sus opciones, elige «Bloquear». Esa tienda ya no podrá
            escribirte. Si además quieres que el equipo lo revise, elige «Denunciar».
          </p>
        </Pregunta>
        <Pregunta titulo="No quiero avisos de noche">
          <p>
            Activa «No molestar» en{' '}
            <Link href="/cuenta/configuracion?seccion=avisos" className={enlace}>
              Configuración · Avisos
            </Link>
            . Los mensajes siguen llegando, y la campanita te avisa al terminar el horario.
          </p>
        </Pregunta>
        <Pregunta titulo="¿Puedo tener respuestas ya escritas?">
          <p>
            Sí: las respuestas rápidas aparecen sobre la caja de texto y las editas en{' '}
            <Link href="/cuenta/configuracion?seccion=preferencias" className={enlace}>
              Configuración · Preferencias
            </Link>
            .
          </p>
        </Pregunta>
      </Seccion>

      <Seccion titulo="¿No encontraste tu respuesta?">
        <p>
          Entonces, <ContactoEquipo mensaje="Hola, tengo una pregunta sobre PaseLibre." />.
        </p>
      </Seccion>
    </Documento>
  );
}
