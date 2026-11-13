import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AjusteLogo, ArchivoSubido } from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';
import sharp, { type OverlayOptions } from 'sharp';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';

/** RNF-20: solo estos formatos, revisando el contenido y no la extensión. */
const FORMATOS = new Set(['jpeg', 'png', 'webp']);
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;
/** Lado mayor de la foto guardada: alcanza para la ficha en pantallas grandes. */
const LADO_MAXIMO = 1600;
/**
 * Las portadas del perfil (docs/19 §20) se guardan más grandes: a lo ancho de una pantalla buena,
 * con 1600 se ven borrosas.
 */
const LADO_MAXIMO_PORTADA = 2400;
/** El logo que arma «Ajustar logo» (docs/19 §20): cuadrado, el mismo en todos lados. */
export const LADO_LOGO = 512;

/** Para qué se sube la foto: las portadas pueden ser más grandes. */
export type UsoDeFoto = 'foto' | 'portada';
/**
 * Evita que una imagen pequeña en bytes pero enorme en píxeles agote la memoria: 24 MP ya
 * pasan los ~100 MB al decodificarse, y la API corre con 512 MB. Una foto de celular tiene 12.
 */
const MAX_PIXELES = 24_000_000;

const FOTO_INVALIDA = 'Sube una foto JPEG, PNG o WebP.';
/** Como las escribe `subir`: así nunca se borra nada fuera de la carpeta de fotos. */
const RUTA_SUBIDA = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/;

/**
 * Fotos de ofertas, productos y, más adelante, del chat (docs/05 §9). Cada foto se vuelve
 * a codificar en WebP: así se descartan los metadatos EXIF (que pueden traer la ubicación),
 * se endereza según la orientación de la cámara y se reduce a un tamaño razonable.
 */
@Injectable()
export class ArchivosService {
  private readonly carpeta: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.carpeta = resolve(config.get('MEDIA_DIR', { infer: true }));
  }

  async subir(
    contenido: Buffer,
    usuario: { id: string; tiendaId: string | null },
    uso: UsoDeFoto = 'foto',
  ): Promise<ArchivoSubido> {
    const { data, info } = await this.procesar(
      contenido,
      uso === 'portada' ? LADO_MAXIMO_PORTADA : LADO_MAXIMO,
    );
    return this.guardar(data, info, usuario);
  }

  /** Escribe la foto ya procesada en la carpeta del mes y la anota como subida por `usuario`. */
  private async guardar(
    data: Buffer,
    info: { width: number; height: number; size: number },
    usuario: { id: string; tiendaId: string | null },
    usadoEn: Date | null = null,
  ): Promise<ArchivoSubido> {
    const ahora = new Date();
    const carpetaMes = `${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`;
    const ruta = `${carpetaMes}/${randomUUID()}.webp`;
    const destino = join(this.carpeta, ruta);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, data, { flag: 'wx' });

    await this.prisma.archivo.create({
      data: {
        usuarioId: usuario.id,
        tiendaId: usuario.tiendaId,
        ruta,
        ancho: info.width,
        alto: info.height,
        bytes: info.size,
        usadoEn,
      },
    });
    return { ruta, ancho: info.width, alto: info.height };
  }

  /**
   * «Ajustar logo» (docs/19 §20): arma el logo cuadrado de 512 × 512 desde la foto original y cómo
   * se acomodó. Se gira la original; el círculo mide `min(ancho, alto) / zoom` de la foto girada y
   * su centro cae en (`x`, `y`) de ella. Lo que queda fuera de la foto se rellena con `fondo`. La
   * web dibuja la vista previa con la misma cuenta. El logo nuevo queda anotado como ya usado.
   */
  async armarLogo(
    original: string,
    ajuste: AjusteLogo,
    usuario: { id: string; tiendaId: string | null },
  ): Promise<ArchivoSubido> {
    let contenido: Buffer;
    try {
      contenido = await readFile(this.rutaEnCarpeta(original));
    } catch {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'No encontramos la imagen de tu logo. Súbela de nuevo.',
      );
    }
    try {
      const girada = await sharp(contenido, { limitInputPixels: MAX_PIXELES })
        .rotate(ajuste.rotacion)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const ancho = girada.info.width;
      const alto = girada.info.height;
      const lado = Math.min(ancho, alto) / ajuste.zoom;
      const izquierda = ajuste.x * ancho - lado / 2;
      const arriba = ajuste.y * alto - lado / 2;
      const escala = LADO_LOGO / lado;

      // La parte de la foto que cae dentro del cuadrado, en píxeles de la foto girada.
      const x0 = Math.max(0, Math.floor(izquierda));
      const y0 = Math.max(0, Math.floor(arriba));
      const x1 = Math.min(ancho, Math.ceil(izquierda + lado));
      const y1 = Math.min(alto, Math.ceil(arriba + lado));
      const capas: OverlayOptions[] = [];
      if (x1 > x0 && y1 > y0) {
        const destinoX = Math.max(0, Math.round((x0 - izquierda) * escala));
        const destinoY = Math.max(0, Math.round((y0 - arriba) * escala));
        const anchoFinal = Math.max(
          1,
          Math.min(LADO_LOGO - destinoX, Math.round((x1 - x0) * escala)),
        );
        const altoFinal = Math.max(
          1,
          Math.min(LADO_LOGO - destinoY, Math.round((y1 - y0) * escala)),
        );
        const recorte = await sharp(girada.data, {
          raw: { width: ancho, height: alto, channels: 4 },
        })
          .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
          .resize(anchoFinal, altoFinal, { fit: 'fill' })
          .png()
          .toBuffer();
        capas.push({ input: recorte, left: destinoX, top: destinoY });
      }
      const fondo =
        ajuste.fondo === 'transparente'
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : {
              r: Number.parseInt(ajuste.fondo.slice(1, 3), 16),
              g: Number.parseInt(ajuste.fondo.slice(3, 5), 16),
              b: Number.parseInt(ajuste.fondo.slice(5, 7), 16),
              alpha: 1,
            };
      const { data, info } = await sharp({
        create: { width: LADO_LOGO, height: LADO_LOGO, channels: 4, background: fondo },
      })
        .composite(capas)
        .webp({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
      return await this.guardar(data, info, usuario, new Date());
    } catch (error) {
      if (error instanceof ApiHttpException) throw error;
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'No pudimos ajustar tu logo. Prueba con otra imagen.',
      );
    }
  }

  /** La ruta de un archivo dentro de la carpeta de fotos; nunca fuera de ella. */
  private rutaEnCarpeta(ruta: string): string {
    const completa = resolve(this.carpeta, ruta);
    if (!completa.startsWith(this.carpeta + sep)) throw new Error('Ruta fuera de la carpeta.');
    return completa;
  }

  /**
   * Marca como usadas fotos que subió alguien de la tienda y que nadie usó todavía.
   * Si alguna no cumple, falla todo: así una foto no termina en dos ofertas ni se
   * cuelga una foto ajena. Se llama dentro de la transacción que la usa.
   */
  async reclamar(
    tx: Prisma.TransactionClient,
    rutas: readonly string[],
    tiendaId: string,
  ): Promise<Map<string, { ancho: number; alto: number }>> {
    if (rutas.length === 0) return new Map();
    const archivos = await tx.archivo.findMany({
      where: { ruta: { in: [...rutas] }, tiendaId, usadoEn: null },
      select: { id: true, ruta: true, ancho: true, alto: true },
    });
    const { count } = await tx.archivo.updateMany({
      where: { id: { in: archivos.map((a) => a.id) }, usadoEn: null },
      data: { usadoEn: new Date() },
    });
    if (archivos.length !== rutas.length || count !== rutas.length) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Una de las fotos no es válida; súbela de nuevo.',
      );
    }
    return new Map(archivos.map((a) => [a.ruta, { ancho: a.ancho, alto: a.alto }]));
  }

  /**
   * Borra las fotos que ya nadie usa: el archivo y su fila (docs/17: al reemplazar o eliminar
   * productos del catálogo). Se llama **después** de la transacción que las dejó sin uso; si esa
   * falla, las fotos siguen ahí. Una ruta que todavía usa un producto, una oferta, un mensaje o
   * una tienda no se toca.
   */
  async borrarSinUso(rutas: readonly string[]): Promise<number> {
    const unicas = [...new Set(rutas)].filter((ruta) => RUTA_SUBIDA.test(ruta));
    if (unicas.length === 0) return 0;
    const usadas = await this.prisma.$queryRaw<Array<{ ruta: string }>>`
      SELECT ruta FROM producto_foto WHERE ruta = ANY(${unicas})
      UNION SELECT ruta FROM oferta_foto WHERE ruta = ANY(${unicas})
      UNION SELECT foto FROM mensaje WHERE foto = ANY(${unicas})
      UNION SELECT foto FROM mensaje_version WHERE foto = ANY(${unicas})
      UNION SELECT logo FROM tienda WHERE logo = ANY(${unicas})
      UNION SELECT logo_original FROM tienda WHERE logo_original = ANY(${unicas})
      UNION SELECT portada_ruta FROM tienda WHERE portada_ruta = ANY(${unicas})`;
    const enUso = new Set(usadas.map((fila) => fila.ruta));
    const libres = unicas.filter((ruta) => !enUso.has(ruta));
    if (libres.length === 0) return 0;
    await this.prisma.archivo.deleteMany({ where: { ruta: { in: libres } } });
    let borradas = 0;
    for (const ruta of libres) {
      try {
        await unlink(join(this.carpeta, ruta));
        borradas++;
      } catch {
        // Ya no estaba: no importa.
      }
    }
    return borradas;
  }

  private async procesar(contenido: Buffer, ladoMaximo: number) {
    try {
      const { format } = await sharp(contenido, { limitInputPixels: MAX_PIXELES }).metadata();
      if (!format || !FORMATOS.has(format)) throw new Error(`Formato no permitido: ${format}`);
      return await sharp(contenido, { limitInputPixels: MAX_PIXELES })
        .rotate()
        .resize({
          width: ladoMaximo,
          height: ladoMaximo,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', FOTO_INVALIDA);
    }
  }
}
