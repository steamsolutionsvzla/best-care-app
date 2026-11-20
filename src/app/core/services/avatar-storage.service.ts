// src/app/core/services/avatar-storage.service.ts
import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const AVATAR_DIR = 'avatars';
const DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/**
 * Guarda la foto de perfil como ARCHIVO PRIVADO de la app (Directory.Data),
 * separada del snapshot médico que vive en SecureStoragePlugin.
 *
 * Motivo (ver MedicalRecordStorageService): SecureStoragePlugin en Android
 * cifra/descifra con RSA-2048 en bloques de 245 bytes; meter ahí una foto
 * hace que arrancar la app y hacer login lean miles de bloques. Un archivo
 * en el sandbox de la app se lee en milisegundos y no necesita cifrado
 * RSA (la foto no es un secreto ni un dato clínico).
 *
 * Solo guarda JPEG ya reducido (ver image.util.ts).
 */
@Injectable({ providedIn: 'root' })
export class AvatarStorageService {
  private pathFor(userId: string): string {
    const safeId = userId.replace(/[^A-Za-z0-9_-]/g, '_');
    return `${AVATAR_DIR}/${safeId}.jpg`;
  }

  /** Escribe la foto (data URL JPEG) en disco. Lanza si no se pudo guardar. */
  async save(userId: string, dataUrl: string): Promise<void> {
    const commaIdx = dataUrl.indexOf(',');
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    await Filesystem.writeFile({
      path: this.pathFor(userId),
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
  }

  /** Lee la foto como data URL; null si no existe o no se pudo leer. */
  async load(userId: string): Promise<string | null> {
    try {
      const res = await Filesystem.readFile({
        path: this.pathFor(userId),
        directory: Directory.Data,
      });
      if (typeof res.data === 'string') {
        return `${DATA_URL_PREFIX}${res.data}`;
      }
      // En web el plugin devuelve un Blob en vez de base64.
      return await this.blobToDataUrl(res.data);
    } catch {
      // El archivo todavía no existe (paciente sin foto): caso normal.
      return null;
    }
  }

  async remove(userId: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: this.pathFor(userId), directory: Directory.Data });
    } catch {
      // No-op: si no existía, no hay nada que borrar.
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
