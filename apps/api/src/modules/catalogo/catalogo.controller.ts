import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  buscarSchema,
  portadaSchema,
  sugerenciasBusquedaSchema,
  type BuscarConsulta,
  type CategoriaResumen,
  type GaleriaResumen,
  type PortadaConsulta,
  type RespuestaBuscar,
  type RespuestaFicha,
  type RespuestaMapaDelSitio,
  type RespuestaMasBuscado,
  type RespuestaSugerenciasBusqueda,
  type RespuestaPortada,
  type RespuestaRedireccion,
  type SugerenciasBusquedaConsulta,
} from '@paselibre/contracts';
import type { Response } from 'express';

import {
  MiradaActual,
  SesionOpcionalGuard,
  type Mirada,
} from '../../shared/guards/sesion-opcional.guard';
import { CachePorAudienciaInterceptor } from '../../shared/interceptors/cache-por-audiencia.interceptor';
import { LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { BusquedaService } from './busqueda.service';
import { CatalogoService } from './catalogo.service';

/**
 * Catálogo público (RF-44): cualquiera lo ve. Con sesión, las mismas rutas suman
 * precios y tiendas; sin sesión, la API ni siquiera los consulta (A-06).
 */
@Controller()
@UseGuards(SesionOpcionalGuard)
@UseInterceptors(CachePorAudienciaInterceptor)
export class CatalogoController {
  constructor(
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
    @Inject(BusquedaService) private readonly busqueda: BusquedaService,
  ) {}

  @Get('portada')
  portada(
    @Query(new ZodValidationPipe(portadaSchema)) consulta: PortadaConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaPortada> {
    return this.catalogo.portada(consulta, mirada);
  }

  @Get('categorias')
  categorias(): Promise<CategoriaResumen[]> {
    return this.catalogo.categorias();
  }

  @Get('galerias')
  galerias(): Promise<GaleriaResumen[]> {
    return this.catalogo.galerias();
  }

  /** Para el `sitemap.xml` de la web (RNF-42): solo lo que ve un visitante. */
  @Get('mapa-del-sitio')
  mapaDelSitio(): Promise<RespuestaMapaDelSitio> {
    return this.catalogo.mapaDelSitio();
  }

  /** Búsqueda: 60 por minuto por persona (o por IP, sin sesión), contra el scraping (docs/05 §9). */
  @Get('buscar')
  @Throttle({ [LIMITE_PERSONA]: { limit: 60, ttl: 60_000 } })
  buscar(
    @Query(new ZodValidationPipe(buscarSchema)) consulta: BuscarConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaBuscar> {
    return this.busqueda.buscar(consulta, mirada);
  }

  /**
   * El desplegable del buscador de la barra, mientras se escribe. La web espera a que se
   * deje de teclear, pero el límite es más alto que el de la búsqueda.
   */
  @Get('buscar/sugerencias')
  @Throttle({ [LIMITE_PERSONA]: { limit: 120, ttl: 60_000 } })
  sugerencias(
    @Query(new ZodValidationPipe(sugerenciasBusquedaSchema)) consulta: SugerenciasBusquedaConsulta,
  ): Promise<RespuestaSugerenciasBusqueda> {
    return this.busqueda.sugerencias(consulta);
  }

  /** «Lo más buscado», para el buscador vacío. */
  @Get('buscar/populares')
  masBuscado(): Promise<RespuestaMasBuscado> {
    return this.busqueda.masBuscado();
  }

  @Get('productos/:slug')
  async ficha(
    @Param('slug') slug: string,
    @MiradaActual() mirada: Mirada,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RespuestaFicha | RespuestaRedireccion> {
    const resultado = await this.catalogo.ficha(slug.toLowerCase(), mirada);
    if ('redirigir_a' in resultado) {
      response.status(HttpStatus.MOVED_PERMANENTLY);
      response.setHeader('Location', `/v1/productos/${encodeURIComponent(resultado.redirigir_a)}`);
    }
    return resultado;
  }
}
