import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ArchivoSubido } from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';
import sharp from 'sharp';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';

/** RNF-20: solo estos formatos, revisando el contenido y no la extensión. */
const FORMATOS = new Set(['jpeg', 'png', 'webp']);
export const MAX_BYTES_FOTO = 8 * 1024 * 1024;
/** Lado mayor de la foto guardada: alcanza para la ficha en pantallas grandes. */
const LADO_MAXIMO = 1600;
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
  ): Promise<ArchivoSubido> {
    const { data, info } = await this.procesar(contenido);

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
      },
    });
    return { ruta, ancho: info.width, alto: info.height };
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
   * falla, las fotos siguen ahí. Una ruta que todavía usa un producto, una oferta, un mensaje,
   * una tienda o un pedido en vivo (doc 19, punto 21) no se toca.
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
      UNION SELECT portada_ruta FROM tienda WHERE portada_ruta = ANY(${unicas})
      UNION SELECT unnest(fotos)::text FROM en_vivo WHERE fotos::text[] && ${unicas}::text[]
      UNION SELECT foto FROM aviso WHERE foto = ANY(${unicas})`;
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

  private async procesar(contenido: Buffer) {
    try {
      const { format } = await sharp(contenido, { limitInputPixels: MAX_PIXELES }).metadata();
      if (!format || !FORMATOS.has(format)) throw new Error(`Formato no permitido: ${format}`);
      return await sharp(contenido, { limitInputPixels: MAX_PIXELES })
        .rotate()
        .resize({
          width: LADO_MAXIMO,
          height: LADO_MAXIMO,
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
