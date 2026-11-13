import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  actualizarCuentaSchema,
  alertaBusquedaSchema,
  avisosCuentaSchema,
  cambioLugarSchema,
  logoTiendaSchema,
  portadaTiendaSchema,
  respuestasRapidasSchema,
  type ActualizarCuentaDatos,
  type AlertaBusqueda,
  type AlertaBusquedaDatos,
  type AvisosCuentaDatos,
  type CambioLugarDatos,
  type GaleriaParaElegir,
  type LogoDatos,
  type MiReporte,
  type PortadaDatos,
  type PortadaTienda,
  type RespuestaAvisosCuenta,
  type RespuestaCuenta,
  type RespuestaLogo,
  type ResumenCuenta,
  type RespuestaRapida,
  type RespuestasRapidasDatos,
  type RespuestaSesiones,
  type TiendaBloqueada,
} from '@paselibre/contracts';
import { z } from 'zod';

import { ApiHttpException } from '../../shared/errors/api-http.exception';
import {
  Permiso,
  PermitirEnSoporte,
  Roles,
  SesionActual,
  SesionGuard,
} from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { permisosDe } from '../sesion/sesion.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { CuentaService } from './cuenta.service';
import { LugarService } from './lugar.service';
import { ResumenService } from './resumen.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));

/**
 * Configuración (docs/05 §6.2): datos de la cuenta, avisos, respuestas rápidas, sesiones
 * abiertas y bloqueados. Todo es de quien tiene la sesión; nada se cachea.
 */
@Controller('cuenta')
@UseGuards(SesionGuard)
export class CuentaController {
  constructor(
    @Inject(CuentaService) private readonly cuentas: CuentaService,
    @Inject(ResumenService) private readonly resumenes: ResumenService,
    @Inject(LugarService) private readonly lugares: LugarService,
  ) {}

  /** «Tu cuenta» y tu perfil (D_Cuenta, P_WebCuentaD2): cómo vende y responde tu tienda. */
  @Get('resumen')
  @Header('Cache-Control', 'no-store')
  resumen(@SesionActual() sesion: SesionActiva): Promise<ResumenCuenta> {
    return this.resumenes.resumen(sesion);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  cuenta(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaCuenta> {
    return this.cuentas.cuenta(usuario.id);
  }

  /**
   * Los datos de la tienda solo los cambia el dueño o el asesor con ese permiso (N12). En modo
   * soporte el equipo cambia los de la tienda, no los de la persona (N14).
   */
  @Patch()
  @PermitirEnSoporte('actualizó los datos de tu tienda')
  @Header('Cache-Control', 'no-store')
  actualizar(
    @Body(new ZodValidationPipe(actualizarCuentaSchema)) cambios: ActualizarCuentaDatos,
    @SesionActual() { usuario, soporte }: SesionActiva,
  ): Promise<RespuestaCuenta> {
    if (cambios.tienda && !permisosDe(usuario).includes('DATOS_TIENDA')) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'SIN_PERMISO',
        'El dueño de tu tienda no te dio permiso para cambiar sus datos.',
      );
    }
    const dePersona = (['nombre', 'correo', 'whatsapp', 'mostrar_visto'] as const).some(
      (campo) => cambios[campo] !== undefined,
    );
    if (soporte && (dePersona || !cambios.tienda)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'MODO_SOPORTE',
        'En modo soporte solo puedes cambiar los datos de la tienda.',
      );
    }
    return this.cuentas.actualizar(usuario.id, cambios);
  }

  /**
   * La portada del perfil (COR1): subir una foto, «Acomodar» o las dos cosas. Dueño y asesor
   * pueden lo mismo dentro de su tienda (docs/05 §9); el equipo no tiene tienda.
   */
  @Put('portada')
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  @PermitirEnSoporte('actualizó tu portada')
  @Header('Cache-Control', 'no-store')
  portada(
    @Body(new ZodValidationPipe(portadaTiendaSchema)) datos: PortadaDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<PortadaTienda> {
    return this.cuentas.portada(usuario.id, datos);
  }

  /**
   * «Guardar» de «Ajustar logo» (docs/19 §20): con `ruta`, una foto nueva; sin ella, se reacomoda
   * la original. La API arma el logo de 512 × 512 y lo deja puesto.
   */
  @Put('logo')
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  @PermitirEnSoporte('ajustó tu logo')
  @Header('Cache-Control', 'no-store')
  logo(
    @Body(new ZodValidationPipe(logoTiendaSchema)) datos: LogoDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaLogo> {
    return this.cuentas.logo(usuario.id, datos);
  }

  /** «Quitar portada»: queda la automática. */
  @Delete('portada')
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  @PermitirEnSoporte('quitó tu portada')
  @HttpCode(HttpStatus.NO_CONTENT)
  async quitarPortada(@SesionActual() { usuario }: SesionActiva): Promise<void> {
    await this.cuentas.quitarPortada(usuario.id);
  }

  /** Para «Galería ▾» en Datos de la tienda (N09). */
  @Get('galerias')
  @Roles('DUENO', 'ASESOR')
  @Header('Cache-Control', 'no-store')
  galerias(): Promise<GaleriaParaElegir[]> {
    return this.lugares.galerias();
  }

  /**
   * Galería, piso y stand nuevos (N09): quedan «Pendiente de aprobación» hasta que el Equipo los
   * confirma. Pedir otro cambio reemplaza al pendiente.
   */
  @Put('lugar')
  @Roles('DUENO', 'ASESOR')
  @Header('Cache-Control', 'no-store')
  pedirLugar(
    @Body(new ZodValidationPipe(cambioLugarSchema)) datos: CambioLugarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaCuenta> {
    return this.lugares.pedir(datos, sesion);
  }

  /** «Dejar como estaba»: retira el cambio pendiente. */
  @Delete('lugar')
  @Roles('DUENO', 'ASESOR')
  @Header('Cache-Control', 'no-store')
  retirarLugar(@SesionActual() sesion: SesionActiva): Promise<RespuestaCuenta> {
    return this.lugares.retirar(sesion);
  }

  @Get('avisos')
  @Header('Cache-Control', 'no-store')
  avisos(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaAvisosCuenta> {
    return this.cuentas.avisos(usuario.id);
  }

  @Put('avisos')
  @Header('Cache-Control', 'no-store')
  guardarAvisos(
    @Body(new ZodValidationPipe(avisosCuentaSchema)) datos: AvisosCuentaDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaAvisosCuenta> {
    return this.cuentas.guardarAvisos(usuario.id, datos);
  }

  /** Sobre la caja de texto del chat (RF-56). */
  @Get('respuestas-rapidas')
  @Header('Cache-Control', 'no-store')
  respuestasRapidas(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaRapida[]> {
    return this.cuentas.respuestasRapidas(usuario.id);
  }

  /** La lista de un papel: «Cuando te escriben» o «Cuando tú preguntas» (N11). */
  @Put('respuestas-rapidas')
  @Header('Cache-Control', 'no-store')
  guardarRespuestasRapidas(
    @Body(new ZodValidationPipe(respuestasRapidasSchema))
    { papel, textos }: RespuestasRapidasDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaRapida[]> {
    return this.cuentas.guardarRespuestasRapidas(usuario.id, papel, textos);
  }

  @Get('sesiones')
  @Header('Cache-Control', 'no-store')
  sesiones(@SesionActual() sesion: SesionActiva): Promise<RespuestaSesiones> {
    return this.cuentas.sesiones(sesion);
  }

  /** «Saltar» o «¡Empezar!» en la bienvenida del primer ingreso: no se muestra más. */
  @Post('bienvenida')
  @HttpCode(HttpStatus.NO_CONTENT)
  bienvenidaVista(@SesionActual() { usuario }: SesionActiva): Promise<void> {
    return this.cuentas.bienvenidaVista(usuario.id);
  }

  /** «Cerrar todas las demás». Va antes de `sesiones/:id` para que no se lea como id. */
  @Post('sesiones/cerrar-otras')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  cerrarOtras(@SesionActual() sesion: SesionActiva): Promise<{ cerradas: number }> {
    return this.cuentas.cerrarOtras(sesion);
  }

  @Delete('sesiones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrarSesion(
    @Param('id', id('Esa sesión ya está cerrada.')) sesionId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.cuentas.cerrarSesion(sesion, sesionId);
  }

  @Get('alertas')
  @Header('Cache-Control', 'no-store')
  alertas(@SesionActual() { usuario }: SesionActiva): Promise<AlertaBusqueda[]> {
    return this.cuentas.alertas(usuario.id);
  }

  @Post('alertas')
  crearAlerta(
    @Body(new ZodValidationPipe(alertaBusquedaSchema)) datos: AlertaBusquedaDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<AlertaBusqueda> {
    return this.cuentas.crearAlerta(usuario.id, datos.texto);
  }

  @Delete('alertas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  borrarAlerta(
    @Param('id', id('Esa alerta no existe.')) alertaId: string,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<void> {
    return this.cuentas.borrarAlerta(usuario.id, alertaId);
  }

  @Get('reportes')
  @Header('Cache-Control', 'no-store')
  reportes(@SesionActual() { usuario }: SesionActiva): Promise<MiReporte[]> {
    return this.cuentas.reportes(usuario.id);
  }

  @Get('bloqueados')
  @Header('Cache-Control', 'no-store')
  bloqueados(@SesionActual() { usuario }: SesionActiva): Promise<TiendaBloqueada[]> {
    return this.cuentas.bloqueados(usuario.id);
  }

  @Delete('bloqueados/:tienda')
  @HttpCode(HttpStatus.NO_CONTENT)
  desbloquear(
    @Param('tienda', id('Esa tienda no existe.')) tiendaId: string,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<void> {
    return this.cuentas.desbloquear(usuario.id, tiendaId);
  }
}
