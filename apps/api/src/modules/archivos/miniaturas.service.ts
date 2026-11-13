import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import type { Environment } from '../../config/env.schema';
import { MemoriaPorClave } from '../../shared/memoria';

/** Evita decodificar una imagen enorme en píxeles (como en `ArchivosService`). */
const MAX_PIXELES = 24_000_000;

/**
 * Versiones chicas de una foto, como `data:` (doc 20, punto 5): el logo y la portada de un perfil
 * privado que ve otra tienda. La web las muestra con `blur(14px)`; como nunca se manda la ruta de
 * la original, no hay forma de «desenfocarlas».
 */
@Injectable()
export class MiniaturasService {
  private readonly carpeta: string;
  private readonly hechas = new MemoriaPorClave<string | null>(10 * 60_000, 2_000);

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.carpeta = resolve(config.get('MEDIA_DIR', { infer: true }));
  }

  /** La foto en `ancho` píxeles (WebP de baja calidad), o nula si no hay o no se pudo leer. */
  async chica(ruta: string | null, ancho: number): Promise<string | null> {
    if (!ruta) return null;
    return this.hechas.recordar(`${ancho}:${ruta}`, async () => {
      const completa = resolve(this.carpeta, ruta);
      // Nunca fuera de la carpeta de fotos.
      if (!completa.startsWith(this.carpeta + sep)) return null;
      try {
        const datos = await sharp(await readFile(completa), { limitInputPixels: MAX_PIXELES })
          .rotate()
          .resize({ width: ancho, withoutEnlargement: true })
          .webp({ quality: 40 })
          .toBuffer();
        return `data:image/webp;base64,${datos.toString('base64')}`;
      } catch {
        return null;
      }
    });
  }
}
