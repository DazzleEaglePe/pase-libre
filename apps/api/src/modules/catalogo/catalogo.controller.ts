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
  masBuscadoSchema,
  portadaSchema,
  preciosCategoriaSchema,
  sugerenciasBusquedaSchema,
  wilsonSchema,
  type BuscarConsulta,
  type CategoriaResumen,
  type GaleriaResumen,
  type MasBuscadoConsulta,
  type PortadaConsulta,
  type PreciosCategoriaConsulta,
  type RespuestaPreciosCategoria,
  type RespuestaWilson,
  type WilsonConsulta,
  type RespuestaBuscar,
  type RespuestaFicha,
  type RespuestaMapaDelSitio,
  type RespuestaBarra,
  type RespuestaMasBuscado,
  type RespuestaSugerenciasBusqueda,
  type RespuestaInicio,
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
import { INTERRUPTOR_EN_VIVO, type InterruptorEnVivo } from '../en-vivo/interruptor';
import { CatalogoService } from './catalogo.service';
import { InicioService } from './inicio.service';
import { WilsonService } from './wilson.service';

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
    @Inject(InicioService) private readonly inicioTienda: InicioService,
    @Inject(WilsonService) private readonly wilsonEnVivo: WilsonService,
    @Inject(INTERRUPTOR_EN_VIVO) private readonly enVivo: InterruptorEnVivo,
  ) {}

  @Get('portada')
  portada(
    @Query(new ZodValidationPipe(portadaSchema)) consulta: PortadaConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaPortada> {
    return this.catalogo.portada(consulta, mirada);
  }

  /** Lo que solo ve una tienda en su inicio (FI_Web, sección 5 del lienzo final). */
  @Get('inicio')
  inicio(@MiradaActual() mirada: Mirada): Promise<RespuestaInicio> {
    return this.inicioTienda.inicio(mirada);
  }

  /** «Wilson en vivo» (CAT_Web3): lo publicado por galería y sus tiendas por piso. */
  @Get('wilson')
  wilson(
    @Query(new ZodValidationPipe(wilsonSchema)) consulta: WilsonConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaWilson> {
    return this.wilsonEnVivo.wilson(consulta, mirada);
  }

  /** «Precios de pase por modelo» de una categoría (CAT_Web4). Solo con sesión. */
  @Get('categorias/:slug/precios')
  preciosDeCategoria(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(preciosCategoriaSchema)) consulta: PreciosCategoriaConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaPreciosCategoria> {
    return this.wilsonEnVivo.precios(slug.toLowerCase(), consulta, mirada);
  }

  @Get('categorias')
  categorias(): Promise<CategoriaResumen[]> {
    return this.catalogo.categorias();
  }

  @Get('galerias')
  galerias(): Promise<GaleriaResumen[]> {
    return this.catalogo.galerias();
  }

  /** Los numeritos de la barra de arriba y del menú de categorías (D_Barra, CAT_Web1). */
  @Get('barra')
  async barra(): Promise<RespuestaBarra> {
    const [recien, buscado] = await Promise.all([
      this.catalogo.recienHoy(),
      this.busqueda.masBuscadoDeHoy(),
    ]);
    return {
      recien_hoy: recien,
      mas_buscado: buscado.terminos,
      mas_buscado_hoy: buscado.hoy,
      en_vivo: this.enVivo.activo,
    };
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
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaSugerenciasBusqueda> {
    return this.busqueda.sugerencias(consulta, mirada);
  }

  /**
   * «Lo más buscado», para el buscador vacío y la página sin resultados; con `categoria`,
   * para el menú de categorías y los resultados de una categoría.
   */
  @Get('buscar/populares')
  masBuscado(
    @Query(new ZodValidationPipe(masBuscadoSchema)) consulta: MasBuscadoConsulta,
  ): Promise<RespuestaMasBuscado> {
    return this.busqueda.masBuscado(consulta);
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
