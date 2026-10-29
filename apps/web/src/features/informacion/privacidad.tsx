import { ContactoEquipo, DatoResponsable, Documento, Seccion } from './documento';

/**
 * Política de privacidad (RNF-21 a RNF-24, Ley 29733). Borrador: ver `BORRADOR` en
 * documento.tsx. Lo que dice de cada dato tiene que seguir siendo cierto en el código
 * (docs/06 y docs/08): si cambia lo que se guarda, cambia este texto.
 */
export function Privacidad() {
  return (
    <Documento
      titulo="Política de privacidad"
      resumen="Qué datos guarda PaseLibre, para qué los usa, quién los ve y cómo pides que los corrijan o los borren."
    >
      <Seccion titulo="1. Quién es responsable">
        <p>
          El responsable de tus datos es <DatoResponsable campo="nombre" />, RUC{' '}
          <DatoResponsable campo="ruc" />, con domicilio en <DatoResponsable campo="direccion" />.
          Para cualquier pedido sobre tus datos,{' '}
          <ContactoEquipo mensaje="Hola, tengo un pedido sobre mis datos en PaseLibre." /> o escribe
          a <DatoResponsable campo="correo" />.
        </p>
        <p>Tratamos tus datos según la Ley 29733, Ley de Protección de Datos Personales.</p>
      </Seccion>

      <Seccion titulo="2. Qué datos guardamos">
        <p>
          <b className="font-semibold">De tu cuenta</b>, los que le das al equipo al crearla o
          cambias en Configuración:
        </p>
        <ul>
          <li>Tu nombre, tu usuario y, si lo das, tu correo.</li>
          <li>
            Tu WhatsApp y el de tu tienda, el nombre de la tienda, su galería, su stand, su horario,
            su descripción y su logo.
          </li>
          <li>Tu contraseña, guardada cifrada de forma que nadie, ni el equipo, puede leerla.</li>
        </ul>
        <p>
          <b className="font-semibold">De lo que haces en PaseLibre:</b>
        </p>
        <ul>
          <li>Tus publicaciones y sus fotos, y las ventas que marcas desde el chat.</li>
          <li>Los mensajes y fotos que mandas en el chat.</li>
          <li>Las tiendas que bloqueas y las denuncias que haces.</li>
          <li>Lo que buscas y cuándo pulsas «Enviar mensaje» o «WhatsApp» en una publicación.</li>
          <li>
            Tus sesiones abiertas (el navegador y la dirección IP desde donde entraste) y la última
            vez que estuviste conectado.
          </li>
        </ul>
        <p>
          <b className="font-semibold">Si miras sin cuenta</b>, solo guardamos lo que buscas, sin
          nada que te identifique.
        </p>
        <p>No guardamos datos de pago ni de tarjetas: PaseLibre no cobra ni recibe pagos.</p>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos">
        <ul>
          <li>
            Para que PaseLibre funcione: mostrar tus publicaciones, poner en contacto a las tiendas,
            entregar los mensajes y avisarte en la campanita.
          </li>
          <li>
            Para cuidar la plataforma: frenar abusos y copias masivas del catálogo, y revisar las
            denuncias.
          </li>
          <li>
            Para mejorarla: saber qué se busca y no se encuentra, y cuánto se usa en cada galería.
            Esto lo miramos en cifras totales, no persona por persona.
          </li>
        </ul>
        <p>
          No vendemos tus datos, no los compartimos con anunciantes y no mostramos publicidad de
          terceros.
        </p>
      </Seccion>

      <Seccion titulo="4. Quién ve qué">
        <ul>
          <li>
            Quien entra sin cuenta ve los productos, pero no ve el nombre de tu tienda, tu stand,
            tus precios ni tu WhatsApp.
          </li>
          <li>
            Quien tiene cuenta ve el nombre de tu tienda, su galería, su stand y los precios que
            elegiste mostrar.
          </li>
          <li>
            Tu WhatsApp solo se entrega a quien tiene cuenta y pulsa el botón «WhatsApp» en una de
            tus publicaciones.
          </li>
          <li>
            Tus mensajes los ven solo tú y la otra persona de la conversación. El equipo de
            PaseLibre no los lee.
          </li>
          <li>
            El equipo ve los datos de las cuentas para crearlas y ayudarte, y no tiene forma de
            entrar a los mensajes.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="5. Dónde se guardan">
        <p>
          En servidores contratados por PaseLibre. Las copias de seguridad de la base de datos y de
          las fotos se guardan en un servicio de almacenamiento fuera del Perú (Backblaze B2), para
          no perder nada si falla el servidor principal.
        </p>
      </Seccion>

      <Seccion titulo="6. Cuánto tiempo">
        <ul>
          <li>Los datos de tu cuenta y tus publicaciones, mientras tu cuenta exista.</li>
          <li>Las copias de seguridad de la base de datos, hasta 4 semanas.</li>
          <li>
            Si pides que se borre tu cuenta, se eliminan tus publicaciones y tus datos personales.
            Las ventas que marcaste quedan solo como cifras, sin datos que te identifiquen.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="7. Tus derechos">
        <p>
          Puedes pedir en cualquier momento <b className="font-semibold">ver</b> qué datos tuyos
          tenemos, <b className="font-semibold">corregirlos</b>,{' '}
          <b className="font-semibold">borrarlos</b> u <b className="font-semibold">oponerte</b> a
          que los usemos para algo. Para hacerlo,{' '}
          <ContactoEquipo mensaje="Hola, quiero ejercer mis derechos sobre mis datos en PaseLibre." />
          . Muchos datos los puedes corregir tú mismo en Configuración.
        </p>
        <p>
          Si no te respondemos en los plazos de la ley o no estás de acuerdo con la respuesta,
          puedes reclamar ante la Autoridad Nacional de Protección de Datos Personales del
          Ministerio de Justicia y Derechos Humanos.
        </p>
      </Seccion>

      <Seccion titulo="8. Cookies">
        <p>
          PaseLibre usa una sola cookie, necesaria para mantener tu sesión abierta después de
          ingresar. No usamos cookies de publicidad ni de seguimiento.
        </p>
      </Seccion>

      <Seccion titulo="9. Menores de edad">
        <p>PaseLibre es para negocios y no está pensado para menores de edad.</p>
      </Seccion>

      <Seccion titulo="10. Cambios a esta política">
        <p>
          Si esta política cambia, la fecha de arriba cambia y, si el cambio es importante, se
          avisará en PaseLibre.
        </p>
      </Seccion>
    </Documento>
  );
}
