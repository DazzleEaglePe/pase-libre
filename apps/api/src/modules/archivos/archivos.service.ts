import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
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
/** Evita que una imagen pequeña en bytes pero enorme en píxeles agote la memoria. */
const MAX_PIXELES = 50_000_000;

const FOTO_INVALIDA = 'Sube una foto JPEG, PNG o WebP.';

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
