'use client';

import {
  CATEGORIAS_REGISTRO,
  DIAS_DE_ATENCION,
  corregirSolicitudSchema,
  crearSolicitudSchema,
  type DatosSolicitudPropios,
  type DiaDeAtencion,
  type RespuestaCodigo,
  type RespuestaOpcionesRegistro,
  type RespuestaRuc,
  type RespuestaSolicitud,
  type RespuestaVerificacion,
} from '@paselibre/contracts';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, botonSecundario, campo, etiqueta } from '@/shared/ui/estilos';

import { guardarConsulta } from './consulta-guardada';

type Alternativa = 'SIN_RUC_DNI' | 'SIN_RUC_RECOMENDACION' | 'SIN_RUC_CREDENCIAL';
type Acreditar = 'RUC' | Alternativa;
type Errores = Record<string, string>;

/** En el celular, el formulario se hace de a un paso; en la computadora se ve entero. */
const PASOS = ['Tu celular', 'Tu negocio', 'Tu stand', 'Encargado y contraseña'] as const;

const PISOS = ['Sótano', '1', '2', '3', '4', '5', 'Otro'] as const;
const ETIQUETA_DIA: Record<DiaDeAtencion, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
};
const ALTERNATIVAS: Array<{ valor: Alternativa; texto: string }> = [
  { valor: 'SIN_RUC_DNI', texto: 'DNI del encargado' },
  { valor: 'SIN_RUC_RECOMENDACION', texto: 'Me recomienda una tienda' },
  { valor: 'SIN_RUC_CREDENCIAL', texto: 'Credencial de la galería' },
];

const chip = (activo: boolean): string =>
  `inline-flex h-10 items-center rounded-full border px-4 text-apoyo ${
    activo ? 'border-tinta bg-tinta font-semibold text-white' : 'border-borde bg-white font-medium'
  }`;

function Tarjeta({
  numero,
  titulo,
  nota,
  visible,
  children,
}: {
  numero: number;
  titulo: string;
  nota?: string;
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`registro-${numero}`}
      className={`flex flex-col gap-4 rounded-2xl border border-linea bg-white p-5 sm:p-6 ${
        visible ? '' : 'max-md:hidden'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tinta text-apoyo font-bold text-white"
        >
          {numero}
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={`registro-${numero}`} tabIndex={-1} className="text-seccion outline-none">
            {titulo}
          </h2>
          {nota && <p className="text-apoyo text-detalle">{nota}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Campo({
  nombre,
  texto,
  ayuda,
  error,
  children,
}: {
  nombre: string;
  texto: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={etiqueta}>
      <label htmlFor={nombre}>{texto}</label>
      {children}
      {ayuda && !error && (
        <span id={`${nombre}-ayuda`} className="text-nota font-normal text-detalle">
          {ayuda}
        </span>
      )}
      {error && (
        <span id={`${nombre}-error`} role="alert" className="text-nota font-normal text-error">
          {error}
        </span>
      )}
    </div>
  );
}

/** Lo que un campo le pasa a su `<input>` para que el lector de pantalla diga ayuda y error. */
function describir(nombre: string, error: string | undefined, conAyuda = false) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${nombre}-error` : conAyuda ? `${nombre}-ayuda` : undefined,
  } as const;
}

/**
 * Crear la cuenta de una tienda (sección 3 del lienzo «Versión final», REG_Web y REG_Cel): celular
 * con código, RUC o «sin RUC», stand y encargado. En el celular se hace de a un paso; en la
 * computadora se ve todo en una página. Con `corregir` vuelve a llenar lo que el equipo pidió.
 */
export function FormularioRegistro({
  opciones,
  corregir,
}: {
  opciones: RespuestaOpcionesRegistro;
  corregir?: { consulta: string; datos: DatosSolicitudPropios; mensaje: string | null };
}) {
  const router = useRouter();
  const inicial = corregir?.datos;
  const [paso, setPaso] = useState(1);

  // 1 · Celular
  const [celular, setCelular] = useState(inicial?.celular ?? '');
  const [codigo, setCodigo] = useState('');
  const [codigoPedido, setCodigoPedido] = useState<RespuestaCodigo | null>(null);
  const [espera, setEspera] = useState(0);
  const [token, setToken] = useState<RespuestaVerificacion | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  // 2 · Negocio
  const [acreditar, setAcreditar] = useState<Acreditar>(inicial?.metodo ?? 'RUC');
  const [ruc, setRuc] = useState(inicial?.ruc ?? '');
  const [rucInfo, setRucInfo] = useState<RespuestaRuc | null>(null);
  const [dni, setDni] = useState('');
  const [recomienda, setRecomienda] = useState(inicial?.recomienda_tienda ?? '');
  const [nombre, setNombre] = useState(inicial?.nombre_comercial ?? '');
  const [categorias, setCategorias] = useState<string[]>(inicial?.categorias ?? []);

  // 3 · Stand
  const [galeria, setGaleria] = useState(inicial?.galeria ?? (inicial?.galeria_otra ? 'otra' : ''));
  const [galeriaOtra, setGaleriaOtra] = useState(inicial?.galeria_otra ?? '');
  const [piso, setPiso] = useState(inicial?.piso ?? '');
  const [stand, setStand] = useState(inicial?.stand ?? '');
  const [referencia, setReferencia] = useState(inicial?.referencia ?? '');
  const [dias, setDias] = useState<DiaDeAtencion[]>(
    inicial?.horario?.dias ?? ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  );
  const [desde, setDesde] = useState(inicial?.horario?.desde ?? '10:00');
  const [hasta, setHasta] = useState(inicial?.horario?.hasta ?? '20:00');

  // 4 · Encargado
  const [encargado, setEncargado] = useState(inicial?.encargado ?? '');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [acepta, setAcepta] = useState(Boolean(corregir));

  const [errores, setErrores] = useState<Errores>({});
  const primerRender = useRef(true);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const celularListo = Boolean(corregir) || Boolean(token);
  const digitosCelular = celular.replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');

  // En el celular, al cambiar de paso el foco va a su título (y la página sube hasta él).
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const titulo = document.getElementById(`registro-${paso}`);
    titulo?.focus();
    titulo?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [paso]);

  // Después de un envío con errores, el foco va al primero (la página de la computadora es larga).
  useEffect(() => {
    const primero = document.querySelector<HTMLElement>('form [aria-invalid="true"]');
    primero?.focus();
  }, [errores]);

  // La cuenta regresiva para pedir otro código.
  useEffect(() => {
    if (espera <= 0) return;
    const reloj = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(reloj);
  }, [espera]);

  const mensajeDe = (error: unknown): string =>
    error instanceof ErrorApi ? error.message : 'Algo falló. Vuelve a intentarlo.';

  async function pedirCodigo(): Promise<void> {
    if (!/^9\d{8}$/.test(digitosCelular)) {
      setErrores({ celular: 'Escribe un celular de 9 dígitos que empiece con 9.' });
      return;
    }
    setErrores({});
    setTrabajando('codigo');
    try {
      const respuesta = await llamarApi<RespuestaCodigo>('/registro/celular', {
        metodo: 'POST',
        cuerpo: { celular: digitosCelular },
      });
      setCodigoPedido(respuesta);
      setEspera(respuesta.reenviar_en_s);
      setCodigo('');
    } catch (error) {
      setErrores({ celular: mensajeDe(error) });
    } finally {
      setTrabajando(null);
    }
  }

  async function usarCodigo(): Promise<void> {
    if (!/^\d{6}$/.test(codigo.trim())) {
      setErrores({ codigo: 'El código lleva 6 dígitos.' });
      return;
    }
    setErrores({});
    setTrabajando('verificar');
    try {
      setToken(
        await llamarApi<RespuestaVerificacion>('/registro/celular/verificar', {
          metodo: 'POST',
          cuerpo: { celular: digitosCelular, codigo: codigo.trim() },
        }),
      );
    } catch (error) {
      setErrores({ codigo: mensajeDe(error) });
    } finally {
      setTrabajando(null);
    }
  }

  async function verificarRuc(): Promise<void> {
    const limpio = ruc.replace(/\D/g, '');
    setRucInfo(null);
    if (limpio.length !== 11) {
      setErrores({ ruc: 'El RUC lleva 11 dígitos.' });
      return;
    }
    setErrores({});
    setTrabajando('ruc');
    try {
      setRucInfo(
        await llamarApi<RespuestaRuc>('/registro/ruc', { metodo: 'POST', cuerpo: { ruc: limpio } }),
      );
    } catch (error) {
      setErrores({ ruc: mensajeDe(error) });
    } finally {
      setTrabajando(null);
    }
  }

  /** Lo que falta en cada paso: el mismo texto que da la API, para no decirlo dos veces distinto. */
  function revisar(numero: number): Errores {
    const e: Errores = {};
    if (numero === 1 && !celularListo)
      e.celular = 'Confirma tu celular con el código que te llega.';
    if (numero === 2) {
      if (acreditar === 'RUC') {
        if (!rucInfo?.encontrado && !corregir) e.ruc = 'Escribe tu RUC y toca «Verificar».';
      } else if (acreditar === 'SIN_RUC_DNI') {
        if (!/^\d{8}$/.test(dni.trim()) && !corregir) e.dni = 'El DNI lleva 8 dígitos.';
      } else if (acreditar === 'SIN_RUC_RECOMENDACION' && recomienda.trim().length < 2) {
        e.recomienda = 'Escribe qué tienda verificada te conoce.';
      }
      if (nombre.trim().length < 2) e.nombre = 'Escribe cómo te conocen en la galería.';
      if (categorias.length === 0) e.categorias = 'Elige al menos una categoría.';
    }
    if (numero === 3) {
      if (!galeria) e.galeria = 'Elige tu galería.';
      if (galeria === 'otra' && galeriaOtra.trim().length < 2)
        e.galeriaOtra = 'Escribe el nombre de tu galería.';
      if (!stand.trim()) e.stand = 'Escribe el número de tu stand.';
      if (dias.length === 0) e.dias = 'Elige al menos un día de atención.';
      else if (desde >= hasta) e.horario = 'Cierras después de abrir.';
    }
    if (numero === 4) {
      if (encargado.trim().length < 2) e.encargado = 'Escribe el nombre del encargado.';
      if ((!corregir || clave) && (clave.length < 8 || !/\d/.test(clave)))
        e.clave = 'La contraseña lleva al menos 8 caracteres y un número.';
      if (!acepta) e.acepta = 'Acepta los términos para continuar.';
    }
    return e;
  }

  function siguiente(): void {
    const faltan = revisar(paso);
    setErrores(faltan);
    if (Object.keys(faltan).length === 0) setPaso((p) => Math.min(PASOS.length, p + 1));
  }

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setErrorGeneral(null);
    if (paso < PASOS.length) {
      // En el celular, «Enter» en un paso intermedio solo avanza.
      if (window.matchMedia('(max-width: 767px)').matches) return siguiente();
    }
    // En la computadora se revisa todo junto; en el celular, el último paso y lo anterior.
    const todos: Errores = {};
    let primerPaso = 0;
    for (let n = 1; n <= PASOS.length; n++) {
      const faltan = revisar(n);
      if (Object.keys(faltan).length > 0 && primerPaso === 0) primerPaso = n;
      Object.assign(todos, faltan);
    }
    setErrores(todos);
    if (primerPaso > 0) {
      setPaso(primerPaso);
      return;
    }

    const comun = {
      nombre_comercial: nombre.trim(),
      categorias,
      galeria: galeria === 'otra' ? null : galeria,
      galeria_otra: galeria === 'otra' ? galeriaOtra.trim() : null,
      piso: piso || null,
      stand: stand.trim(),
      referencia: referencia.trim() || null,
      horario: { dias, desde, hasta },
      encargado: encargado.trim(),
      acepta_terminos: true as const,
    };
    const porMetodo =
      acreditar === 'RUC'
        ? { metodo: 'RUC' as const, ruc: ruc.replace(/\D/g, '') }
        : acreditar === 'SIN_RUC_DNI'
          ? { metodo: acreditar, dni: dni.trim() }
          : acreditar === 'SIN_RUC_RECOMENDACION'
            ? { metodo: acreditar, recomienda_tienda: recomienda.trim() }
            : { metodo: acreditar };
    const cuerpo = corregir
      ? { ...comun, ...porMetodo, ...(clave ? { clave } : {}) }
      : { ...comun, ...porMetodo, token_celular: token?.token_celular ?? '', clave };

    // La API repite esta revisión; aquí solo se adelanta para decirlo sin esperar.
    const revisado = (corregir ? corregirSolicitudSchema : crearSolicitudSchema).safeParse(cuerpo);
    if (!revisado.success) {
      setErrorGeneral(revisado.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }

    setTrabajando('enviar');
    try {
      const respuesta = await llamarApi<RespuestaSolicitud>(
        corregir ? `/registro/solicitudes/${corregir.consulta}` : '/registro/solicitudes',
        { metodo: corregir ? 'PUT' : 'POST', cuerpo },
      );
      const codigoConsulta = respuesta.consulta ?? corregir?.consulta;
      if (codigoConsulta) {
        guardarConsulta(codigoConsulta);
        router.push(`/registro/solicitud/${codigoConsulta}`);
      }
    } catch (error) {
      setErrorGeneral(mensajeDe(error));
      // Si el código del celular ya no vale, vuelve al primer paso para pedir otro.
      if (error instanceof ErrorApi && /celular otra vez/i.test(error.message)) {
        setToken(null);
        setCodigoPedido(null);
        setPaso(1);
      }
    } finally {
      setTrabajando(null);
    }
  }

  const alternar = <T extends string>(lista: T[], valor: T): T[] =>
    lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];

  return (
    <form
      onSubmit={enviar}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-titulo">
            {corregir ? 'Corrige tu solicitud' : 'Crea la cuenta de tu tienda'}
          </h1>
          <p className="text-cuerpo text-secundario">
            {corregir
              ? 'Cambia lo que te pidió el equipo y la volvemos a revisar.'
              : 'Gratis para las tiendas fundadoras. Para tiendas con stand en las galerías de Wilson. Toma unos 3 minutos.'}
          </p>
        </header>

        {corregir?.mensaje && (
          <div role="status" className="rounded-2xl bg-aviso-fondo p-4 text-apoyo text-aviso">
            <b className="font-semibold">El equipo te escribió:</b> {corregir.mensaje}
          </div>
        )}

        <div className="flex flex-col gap-2 md:hidden" aria-hidden="true">
          <div className="flex gap-1.5">
            {PASOS.map((nombrePaso, i) => (
              <span
                key={nombrePaso}
                className={`h-1.5 flex-1 rounded-full ${i + 1 <= paso ? 'bg-pase' : 'bg-linea'}`}
              />
            ))}
          </div>
        </div>
        <p className="text-apoyo font-medium text-detalle md:hidden">
          Paso {paso} de {PASOS.length} · {PASOS[paso - 1]}
        </p>

        {!corregir && (
          <Tarjeta
            numero={1}
            titulo="Tu celular"
            nota="Para avisarte y para entrar. No lo verán otras tiendas."
            visible={paso === 1}
          >
            {celularListo ? (
              <p className="flex items-center gap-2 text-cuerpo font-semibold text-ok">
                <IconCheck size={20} stroke={2} aria-hidden="true" />
                Celular confirmado · {digitosCelular.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')}
              </p>
            ) : (
              <>
                <Campo nombre="celular" texto="Celular del encargado" error={errores.celular}>
                  <div className="flex gap-2">
                    <span className="flex h-12 items-center rounded-xl border border-borde bg-superficie px-3.5 text-cuerpo text-secundario">
                      +51
                    </span>
                    <input
                      id="celular"
                      {...describir('celular', errores.celular)}
                      name="celular"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder="987 654 321"
                      className={campo}
                    />
                  </div>
                </Campo>
                <button
                  type="button"
                  onClick={pedirCodigo}
                  disabled={trabajando === 'codigo' || espera > 0}
                  className={`${botonSecundario} self-start`}
                >
                  {espera > 0
                    ? `Pedir otro código en ${espera} s`
                    : codigoPedido
                      ? 'Enviarme otro código'
                      : 'Enviarme el código'}
                </button>
                {codigoPedido && (
                  <>
                    <Campo
                      nombre="codigo"
                      texto="Código que te llegó por SMS"
                      ayuda="Llega en unos segundos."
                      error={errores.codigo}
                    >
                      <input
                        id="codigo"
                        {...describir('codigo', errores.codigo, true)}
                        name="codigo"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className={`${campo} max-w-[200px] tracking-[0.3em]`}
                      />
                    </Campo>
                    {codigoPedido.codigo_prueba && (
                      <p className="rounded-xl bg-aviso-fondo p-3 text-nota text-aviso">
                        Modo de prueba: no se manda un SMS de verdad. Tu código es{' '}
                        <b className="font-semibold">{codigoPedido.codigo_prueba}</b>.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={usarCodigo}
                      disabled={trabajando === 'verificar'}
                      className={`${botonPrincipal} self-start`}
                    >
                      Usar el código
                    </button>
                  </>
                )}
              </>
            )}
          </Tarjeta>
        )}

        <Tarjeta
          numero={2}
          titulo="Tu negocio"
          nota="Con RUC quedas verificado al instante; sin RUC te revisa una persona."
          visible={paso === 2}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoyo font-medium">¿Cómo verificamos tu tienda?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [
                    'RUC',
                    'Con RUC',
                    'Lo revisamos con SUNAT y quedas verificado al toque.',
                    'Al instante',
                  ],
                  ['SIN_RUC_DNI', 'Sin RUC', 'Te revisa una persona del equipo.', 'Máx. 3 horas'],
                ] as const
              ).map(([valor, titulo, detalle, etiquetaTiempo]) => {
                const activo = valor === 'RUC' ? acreditar === 'RUC' : acreditar !== 'RUC';
                return (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      if (valor === 'RUC') setAcreditar('RUC');
                      else if (acreditar === 'RUC') setAcreditar('SIN_RUC_DNI');
                      setErrores({});
                    }}
                    className={`flex flex-col items-start gap-1 rounded-2xl p-4 text-left ${
                      activo ? 'border-2 border-tinta' : 'border border-borde'
                    }`}
                  >
                    <span className="text-tarjeta">{titulo}</span>
                    <span className="text-apoyo text-secundario">{detalle}</span>
                    <span
                      className={`mt-1 rounded-full px-2 text-nota font-semibold ${
                        valor === 'RUC' ? 'bg-pase-medio text-ok' : 'bg-aviso-fondo text-aviso'
                      }`}
                    >
                      {etiquetaTiempo}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {acreditar === 'RUC' ? (
            <>
              <Campo nombre="ruc" texto="RUC" error={errores.ruc}>
                <div className="flex gap-2">
                  <input
                    id="ruc"
                    {...describir('ruc', errores.ruc)}
                    name="ruc"
                    inputMode="numeric"
                    maxLength={11}
                    value={ruc}
                    onChange={(e) => {
                      setRuc(e.target.value.replace(/\D/g, ''));
                      setRucInfo(null);
                    }}
                    placeholder="20512345671"
                    className={campo}
                  />
                  <button
                    type="button"
                    onClick={verificarRuc}
                    disabled={trabajando === 'ruc'}
                    className={botonSecundario}
                  >
                    Verificar
                  </button>
                </div>
              </Campo>
              {rucInfo && (
                <div
                  role="status"
                  className={`rounded-2xl p-4 text-apoyo ${
                    rucInfo.apto
                      ? 'bg-pase-suave'
                      : rucInfo.encontrado
                        ? 'bg-aviso-fondo text-aviso'
                        : 'bg-error-fondo text-error'
                  }`}
                >
                  {rucInfo.datos ? (
                    <div className="flex flex-col gap-0.5">
                      <b className="text-tarjeta">{rucInfo.datos.razon_social}</b>
                      <span>
                        Encontrado en SUNAT · {rucInfo.datos.estado[0]}
                        {rucInfo.datos.estado.slice(1).toLowerCase()} · {rucInfo.datos.condicion[0]}
                        {rucInfo.datos.condicion.slice(1).toLowerCase()}
                      </span>
                      <span>Domicilio fiscal en {rucInfo.datos.domicilio}</span>
                      {!rucInfo.apto && (
                        <span className="mt-1 font-semibold">
                          Como no está activo y habido, una persona del equipo lo revisará.
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>
                      SUNAT no encontró ese RUC. Revísalo o elige «Sin RUC»: también puedes
                      registrarte.
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="rounded-xl bg-pase-suave p-3 text-apoyo">
                Sin problema, también puedes registrarte sin RUC. Como no podemos verificarlo al
                instante, una persona de nuestro equipo revisará tu cuenta y te avisaremos en un
                máximo de 3 horas.
              </p>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-apoyo font-medium">
                  Elige cómo acreditar tu tienda
                </legend>
                <div className="flex flex-wrap gap-2">
                  {ALTERNATIVAS.map(({ valor, texto }) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={acreditar === valor}
                      onClick={() => {
                        setAcreditar(valor);
                        setErrores({});
                      }}
                      className={chip(acreditar === valor)}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              </fieldset>
              {acreditar === 'SIN_RUC_DNI' && (
                <Campo
                  nombre="dni"
                  texto="DNI del encargado"
                  ayuda="Solo lo ve el equipo de PaseLibre y se borra cuando revisan tu solicitud."
                  error={errores.dni}
                >
                  <input
                    id="dni"
                    {...describir('dni', errores.dni, true)}
                    name="dni"
                    inputMode="numeric"
                    maxLength={8}
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                    placeholder={corregir ? 'Déjalo vacío para conservar el tuyo' : '12345678'}
                    className={`${campo} max-w-[240px]`}
                  />
                </Campo>
              )}
              {acreditar === 'SIN_RUC_RECOMENDACION' && (
                <Campo
                  nombre="recomienda"
                  texto="¿Qué tienda verificada te conoce?"
                  ayuda="Le preguntaremos a esa tienda si te conoce. Solo tiene que tocar «Sí, la conozco»."
                  error={errores.recomienda}
                >
                  <input
                    id="recomienda"
                    {...describir('recomienda', errores.recomienda, true)}
                    name="recomienda"
                    value={recomienda}
                    onChange={(e) => setRecomienda(e.target.value)}
                    placeholder="Nombre de la tienda"
                    className={campo}
                  />
                </Campo>
              )}
              {acreditar === 'SIN_RUC_CREDENCIAL' && (
                <p className="text-apoyo text-secundario">
                  Te pediremos una foto de tu credencial o del contrato del stand (el que te dio la
                  administración de la galería) por WhatsApp cuando revisemos tu solicitud.
                </p>
              )}
            </div>
          )}

          <Campo
            nombre="nombre"
            texto="¿Cómo te conocen en la galería? (es el nombre que verán las tiendas)"
            error={errores.nombre}
          >
            <input
              id="nombre"
              {...describir('nombre', errores.nombre)}
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              className={campo}
            />
          </Campo>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoyo font-medium">
              ¿Qué vendes? (elige todas las que apliquen)
            </legend>
            <div className="flex flex-wrap gap-2">
              {(opciones.categorias.length ? opciones.categorias : CATEGORIAS_REGISTRO).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={categorias.includes(c)}
                  onClick={() => setCategorias((lista) => alternar(lista, c))}
                  className={chip(categorias.includes(c))}
                >
                  {c}
                </button>
              ))}
            </div>
            {errores.categorias && (
              <span role="alert" className="text-nota text-error">
                {errores.categorias}
              </span>
            )}
          </fieldset>
        </Tarjeta>

        <Tarjeta numero={3} titulo="Tu stand" visible={paso === 3}>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoyo font-medium">Galería</legend>
            <div className="flex flex-wrap gap-2">
              {opciones.galerias.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  aria-pressed={galeria === g.slug}
                  onClick={() => setGaleria(g.slug)}
                  className={chip(galeria === g.slug)}
                >
                  {g.nombre}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={galeria === 'otra'}
                onClick={() => setGaleria('otra')}
                className={chip(galeria === 'otra')}
              >
                Otra galería
              </button>
            </div>
            {errores.galeria && (
              <span role="alert" className="text-nota text-error">
                {errores.galeria}
              </span>
            )}
          </fieldset>
          {galeria === 'otra' && (
            <>
              <Campo nombre="galeria-otra" texto="Nombre de la galería" error={errores.galeriaOtra}>
                <input
                  id="galeria-otra"
                  {...describir('galeria-otra', errores.galeriaOtra)}
                  value={galeriaOtra}
                  onChange={(e) => setGaleriaOtra(e.target.value)}
                  maxLength={120}
                  className={campo}
                />
              </Campo>
              <p className="text-apoyo text-secundario">
                ¡Qué bueno que se sumen más galerías! Como todavía no la tenemos registrada, una
                persona de nuestro equipo la agregará al revisar tu solicitud.
              </p>
            </>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoyo font-medium">Piso</legend>
            <div className="flex flex-wrap gap-2">
              {PISOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={piso === p}
                  onClick={() => setPiso(piso === p ? '' : p)}
                  className={chip(piso === p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo nombre="stand" texto="Número de stand" error={errores.stand}>
              <input
                id="stand"
                {...describir('stand', errores.stand)}
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                maxLength={20}
                className={campo}
              />
            </Campo>
            <Campo nombre="referencia" texto="Una referencia para llegar (opcional)">
              <input
                id="referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                maxLength={200}
                placeholder="Al lado de las escaleras"
                className={campo}
              />
            </Campo>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoyo font-medium">Horario</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_DE_ATENCION.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={dias.includes(d)}
                  onClick={() => setDias((lista) => alternar(lista, d))}
                  className={chip(dias.includes(d))}
                >
                  {ETIQUETA_DIA[d]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-apoyo">
                De
                <input
                  type="time"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className={`${campo} w-[150px]`}
                />
              </label>
              <label className="flex items-center gap-2 text-apoyo">
                a
                <input
                  type="time"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className={`${campo} w-[150px]`}
                />
              </label>
            </div>
            {(errores.dias || errores.horario) && (
              <span role="alert" className="text-nota text-error">
                {errores.dias ?? errores.horario}
              </span>
            )}
          </fieldset>
        </Tarjeta>

        <Tarjeta
          numero={4}
          titulo="Encargado y contraseña"
          nota="Las fotos del stand son opcionales: envíalas al equipo por el chat cuando tu cuenta esté aprobada."
          visible={paso === 4}
        >
          <Campo nombre="encargado" texto="Nombre del encargado" error={errores.encargado}>
            <input
              id="encargado"
              {...describir('encargado', errores.encargado)}
              value={encargado}
              onChange={(e) => setEncargado(e.target.value)}
              maxLength={120}
              autoComplete="name"
              className={campo}
            />
          </Campo>
          <Campo
            nombre="clave"
            texto={corregir ? 'Contraseña nueva (opcional)' : 'Crea tu contraseña'}
            ayuda={
              corregir
                ? 'Déjala vacía para conservar la que elegiste.'
                : 'Mínimo 8 caracteres y un número. Entrarás con tu celular y esta contraseña.'
            }
            error={errores.clave}
          >
            <div className="relative">
              <input
                id="clave"
                {...describir('clave', errores.clave, true)}
                type={verClave ? 'text' : 'password'}
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                maxLength={128}
                className={`${campo} pr-24`}
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                className="absolute right-1 top-1 h-10 rounded-full px-4 text-apoyo font-medium"
              >
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </Campo>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 text-apoyo">
              <input
                type="checkbox"
                checked={acepta}
                onChange={(e) => setAcepta(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-pase"
              />
              <span>
                Acepto los{' '}
                <Link href="/terminos" target="_blank" className="font-medium underline">
                  términos de uso
                </Link>{' '}
                y las reglas de la comunidad. PaseLibre no cobra ni intermedia pagos: el trato es
                entre vendedores.
              </span>
            </label>
            {errores.acepta && (
              <span role="alert" className="text-nota text-error">
                {errores.acepta}
              </span>
            )}
          </div>
        </Tarjeta>

        {errorGeneral && (
          <p role="alert" className="rounded-xl bg-error-fondo p-3 text-apoyo text-error">
            {errorGeneral}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPaso((p) => Math.max(1, p - 1))}
            className={`${botonSecundario} md:hidden ${paso === 1 ? 'invisible' : ''}`}
          >
            Atrás
          </button>
          {paso < PASOS.length ? (
            <button type="button" onClick={siguiente} className={`${botonPrincipal} md:hidden`}>
              Siguiente
            </button>
          ) : null}
          <button
            type="submit"
            disabled={trabajando === 'enviar'}
            className={`${botonPrincipal} ${paso < PASOS.length ? 'max-md:hidden' : ''} md:ml-auto`}
          >
            {trabajando === 'enviar'
              ? 'Enviando…'
              : corregir
                ? 'Enviar la corrección'
                : 'Enviar solicitud'}
          </button>
        </div>
      </div>

      {/* REG_Web: lo que lleva tu solicitud y qué pasa después. */}
      <aside
        aria-label="Tu solicitud"
        className="hidden flex-col gap-4 rounded-[20px] border border-linea bg-white p-5 lg:sticky lg:top-6 lg:mt-[92px] lg:flex"
      >
        <b className="text-cuerpo font-bold">Tu solicitud</b>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-apoyo">
          {(
            [
              [Boolean(token), token ? 'Tu celular, confirmado' : 'Tu celular'],
              acreditar === 'RUC'
                ? [Boolean(rucInfo?.apto), 'RUC verificado en SUNAT']
                : [Boolean(dni), 'Sin RUC: te revisa una persona'],
              [
                Boolean(galeria && stand),
                galeria && stand
                  ? `Stand: ${
                      galeria === 'otra'
                        ? galeriaOtra || 'otra galería'
                        : (opciones.galerias.find((g) => g.slug === galeria)?.nombre ?? galeria)
                    }${piso ? `, piso ${piso}` : ''} · ${stand}`
                  : 'Tu stand',
              ],
              [
                Boolean(encargado.trim()),
                encargado.trim() ? `Encargado: ${encargado.trim()}` : 'Encargado',
              ],
            ] as Array<[boolean, string]>
          ).map(([listo, texto]) => (
            <li
              key={texto}
              className={`flex items-start gap-2 ${listo ? 'text-tinta' : 'text-secundario'}`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  listo ? 'text-pase' : 'border border-borde'
                }`}
              >
                {listo ? '✓' : ''}
              </span>
              {texto}
              <span className="sr-only">{listo ? ' (listo)' : ' (falta)'}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 border-t border-linea pt-4">
          <b className="text-apoyo font-bold">¿Qué pasa después?</b>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {(
              [
                ['Envías la solicitud', 'Ahora', true],
                [
                  'La revisamos',
                  acreditar === 'RUC' ? 'Con RUC, al instante' : 'Una persona, en máx. 3 horas',
                  false,
                ],
                ['Te avisamos por SMS', 'Aprobada o con algo por corregir', false],
              ] as Array<[string, string, boolean]>
            ).map(([titulo, detalle, primero]) => (
              <li key={titulo} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                    primero ? 'bg-pase text-white' : 'bg-linea text-secundario'
                  }`}
                >
                  {primero ? '✓' : ''}
                </span>
                <span className="flex flex-col">
                  <b className="text-apoyo font-bold">{titulo}</b>
                  <span className="text-nota text-secundario">{detalle}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </form>
  );
}
