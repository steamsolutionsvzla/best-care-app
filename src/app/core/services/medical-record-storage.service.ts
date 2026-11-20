// src/app/core/services/medical-record-storage.service.ts
import { Injectable, inject } from '@angular/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { PatientProfile } from '../models/patient-profile.model';
import { MedicalRecord } from '../models/medical-record.model';
import { startPerfTimer } from '../utils/perf.util';
import { resizeImageToJpegDataUrl } from '../utils/image.util';
import { AvatarStorageService } from './avatar-storage.service';

const CACHE_KEY_PREFIX = 'bc_medical_cache_';
/**
 * v1: la foto de perfil (base64, sin reducir) viajaba DENTRO del snapshot.
 * v2: el snapshot NO incluye la foto; vive en su propio archivo
 *     (AvatarStorageService). Los snapshots v1 se migran solos al leerlos.
 */
const CACHE_VERSION = 2;

export interface MedicalRecordSnapshot {
  version: number;
  savedAt: string;
  profile: PatientProfile;
  medicalRecord: MedicalRecord;
}

/**
 * Caché local, por paciente, de alergias/medicamentos/diagnósticos y
 * contactos de emergencia. Vive en el almacenamiento seguro del
 * dispositivo (Keychain en iOS / Keystore en Android) usando el mismo
 * plugin que ya usa TokenStorageService (capacitor-secure-storage-plugin),
 * en vez de localStorage/sessionStorage del WebView (sin cifrar y, en
 * zoneless/producción, no garantizado que sobreviva igual que el storage
 * nativo).
 *
 * POR QUÉ EXISTE (causa raíz de "no se guarda la información"):
 * 1) Hasta ahora NO existía ningún tipo de persistencia en el dispositivo:
 *    `PatientDataService.medicalRecord` es un signal que solo vive en RAM.
 *    Cerrar la app, matarla en segundo plano o reiniciar el teléfono borra
 *    todo lo agregado.
 * 2) El único intento de guardar remotamente reutiliza POST /patient/update
 *    con llaves (allergies, current_medications, diagnoses,
 *    emergency_contacts) que Bigback no confirma que acepte ni persista
 *    (no hay endpoint dedicado en la colección de Postman entregada).
 * 3) Aun si Bigback llegara a guardarlas, `fhirPatientToMedicalRecord`
 *    (ver core/utils/fhir-patient.mapper.ts) hoy SIEMPRE devuelve `[]` para
 *    medicamentos, diagnósticos y contactos de emergencia al leer
 *    /patient/me, y solo intenta leer alergias desde una extensión FHIR
 *    cuya URL es un supuesto sin confirmar. Es decir: aunque el POST
 *    "funcionara", el próximo GET/login pisaría el signal con arreglos
 *    vacíos (`setFromFhir` hace `.set(...)`, no un merge).
 *
 * Esta caché resuelve (1) de forma inmediata y sirve de red de seguridad
 * para (2)/(3): PatientDataService la usa como fuente de verdad para esas
 * 4 colecciones mientras el backend no confirme un contrato real, y las
 * sobrepone después de cada `setFromFhir` (login / restauración de sesión)
 * para que no desaparezcan.
 *
 * No se borra en logout a propósito: si el mismo paciente vuelve a
 * iniciar sesión en el mismo teléfono, recupera su información. Se
 * limpia solo si se llama a `clear()` explícitamente o si se desinstala
 * la app (el Keystore/Keychain se borra con la desinstalación).
 *
 * POR QUÉ LA FOTO YA NO VA AQUÍ (causa de un login lento):
 * En Android, capacitor-secure-storage-plugin cifra con RSA-2048 y, cuando
 * el valor supera 245 bytes, lo parte en bloques y hace UNA operación RSA
 * por bloque (al leer, con la clave privada del Keystore). Una foto de
 * cámara en base64 (~4-7 MB) son ~17,000-29,000 bloques a descifrar en
 * cada arranque y en cada login. Por eso el snapshot ahora guarda solo
 * datos (~4 KB, ~40 bloques) y la foto se guarda reducida (512 px, JPEG) en
 * un archivo privado aparte (AvatarStorageService).
 */
@Injectable({ providedIn: 'root' })
export class MedicalRecordStorageService {
  private avatars = inject(AvatarStorageService);

  /**
   * Última foto que ya quedó escrita en disco, por paciente. Evita reescribir
   * el archivo de la foto en cada guardado del snapshot (p. ej. cada vez que
   * se agrega una alergia).
   */
  private persistedAvatar = new Map<string, string>();

  private keyFor(userId: string): string {
    return `${CACHE_KEY_PREFIX}${userId}`;
  }

  async save(userId: string, profile: PatientProfile, medicalRecord: MedicalRecord): Promise<void> {
    if (!userId) return; // Sin userId no hay bajo qué llave guardar de forma consistente.

    // 1) La foto va a su propio archivo, y solo si cambió.
    let avatarInFile = false;
    const avatarUrl = profile.avatarUrl;
    if (avatarUrl) {
      if (this.persistedAvatar.get(userId) === avatarUrl) {
        avatarInFile = true;
      } else {
        try {
          await this.avatars.save(userId, avatarUrl);
          this.persistedAvatar.set(userId, avatarUrl);
          avatarInFile = true;
        } catch (err) {
          // Red de seguridad: si no se pudo escribir el archivo (p. ej. el
          // plugin de Filesystem no está sincronizado en nativo), la foto
          // se queda dentro del snapshot como antes, para no perderla.
          console.error('[BestCare][MedicalRecordStorageService] no se pudo guardar la foto en archivo; se conserva en el snapshot', err);
        }
      }
    }

    // 2) El snapshot (pequeño) va a SecureStorage, sin la foto si ya está en archivo.
    await this.writeSnapshot(
      userId,
      avatarInFile ? { ...profile, avatarUrl: undefined } : profile,
      medicalRecord,
    );
  }

  async load(userId: string): Promise<MedicalRecordSnapshot | null> {
    if (!userId) return null;
    const perf = startPerfTimer('caché.load');
    try {
      // El snapshot y la foto son independientes: se leen en PARALELO.
      const [secure, avatar] = await Promise.all([
        this.timed(SecureStoragePlugin.get({ key: this.keyFor(userId) }).catch(() => null)),
        this.timed(this.avatars.load(userId)),
      ]);
      const value = secure.result?.value;
      perf.lap('lecturas (SecureStorage ‖ foto en paralelo)');
      if (!value) {
        perf.end(`sin datos · SecureStorage.get=${secure.ms}ms`);
        return null;
      }

      const snapshot = JSON.parse(value) as MedicalRecordSnapshot;
      perf.lap('JSON.parse');

      let extra = `snapshot=${Math.round(value.length / 1024)}KB (get=${secure.ms}ms) · foto en archivo=${avatar.result ? Math.round(avatar.result.length / 1024) + 'KB' : 'no'} (read=${avatar.ms}ms)`;

      const legacyAvatar = snapshot.profile?.avatarUrl;
      if (legacyAvatar) {
        // Snapshot v1: la foto venía dentro. Se reduce, se pasa a archivo y
        // se reescribe el snapshot sin ella. Es un costo de UNA sola vez.
        snapshot.profile.avatarUrl = await this.migrateLegacyAvatar(userId, snapshot, legacyAvatar);
        perf.lap('migración foto v1→v2');
        extra += ' · MIGRACIÓN v1→v2 ejecutada';
      } else if (avatar.result) {
        snapshot.profile.avatarUrl = avatar.result;
        this.persistedAvatar.set(userId, avatar.result);
      }

      perf.end(extra);
      return snapshot;
    } catch {
      // El plugin lanza excepción si la key no existe todavía (primer uso
      // de la app o paciente que nunca guardó nada localmente).
      return null;
    }
  }

  async clear(userId: string): Promise<void> {
    if (!userId) return;
    this.persistedAvatar.delete(userId);
    await this.avatars.remove(userId);
    try {
      await SecureStoragePlugin.remove({ key: this.keyFor(userId) });
    } catch {
      // No-op: si no existía, no hay nada que borrar.
    }
  }

  /**
   * Migra la foto de un snapshot v1: la reduce (512 px JPEG), la escribe en
   * su archivo y reescribe el snapshot SIN la foto (en segundo plano, para no
   * retrasar el arranque). Devuelve la foto a usar en memoria.
   * Si algo falla, devuelve la foto original y no toca el snapshot: se
   * reintentará en el siguiente arranque y no se pierde nada.
   */
  private async migrateLegacyAvatar(
    userId: string,
    snapshot: MedicalRecordSnapshot,
    legacyAvatar: string,
  ): Promise<string> {
    try {
      const small = await resizeImageToJpegDataUrl(legacyAvatar);
      await this.avatars.save(userId, small);
      this.persistedAvatar.set(userId, small);
      void this.writeSnapshot(userId, { ...snapshot.profile, avatarUrl: undefined }, snapshot.medicalRecord);
      return small;
    } catch (err) {
      console.error('[BestCare][MedicalRecordStorageService] no se pudo migrar la foto v1→v2; se reintentará', err);
      return legacyAvatar;
    }
  }

  private async writeSnapshot(userId: string, profile: PatientProfile, medicalRecord: MedicalRecord): Promise<void> {
    const snapshot: MedicalRecordSnapshot = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      profile,
      medicalRecord,
    };
    try {
      await SecureStoragePlugin.set({ key: this.keyFor(userId), value: JSON.stringify(snapshot) });
    } catch (err) {
      // No relanzamos: un fallo de storage nativo no debe romper la UI ni
      // impedir el intento de sincronización remota que sigue después.
      console.error('[BestCare][MedicalRecordStorageService] no se pudo guardar el caché local', err);
    }
  }

  private async timed<T>(promise: Promise<T>): Promise<{ result: T; ms: number }> {
    const t0 = performance.now();
    const result = await promise;
    return { result, ms: Math.round(performance.now() - t0) };
  }
}
