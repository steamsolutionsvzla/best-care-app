// src/app/core/services/token-storage.service.ts
import { Injectable } from '@angular/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const TOKEN_KEY = 'bc_auth_token';
const LAST_USER_KEY = 'bc_last_user_id';

/**
 * Guarda el auth_token de Bigback en almacenamiento seguro del dispositivo
 * (Keychain en iOS / Keystore en Android, vía capacitor-secure-storage-plugin).
 *
 * IMPORTANTE: nunca guardar el auth_token en localStorage/sessionStorage:
 * en un WebView de Capacitor esos storages no están cifrados y son
 * accesibles si el dispositivo está comprometido. Al tratarse de datos
 * médicos (FHIR), el token debe protegerse igual que un dato sensible.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  async setToken(token: string): Promise<void> {
    await SecureStoragePlugin.set({ key: TOKEN_KEY, value: token });
  }

  async getToken(): Promise<string | null> {
    try {
      const { value } = await SecureStoragePlugin.get({ key: TOKEN_KEY });
      return value ?? null;
    } catch {
      // El plugin lanza excepción si la key no existe todavía (primer uso de la app)
      return null;
    }
  }

  /**
   * Último paciente con sesión iniciada. La caché local se guarda por userId,
   * pero el userId solo se conoce tras /patient/me; guardándolo aquí se puede
   * abrir la app SIN CONEXIÓN con los datos de la caché (ver
   * AuthService.restoreSession).
   */
  async setLastUserId(userId: string): Promise<void> {
    try {
      await SecureStoragePlugin.set({ key: LAST_USER_KEY, value: userId });
    } catch {
      // No crítico: sin esto solo se pierde el modo sin conexión.
    }
  }

  async getLastUserId(): Promise<string | null> {
    try {
      const { value } = await SecureStoragePlugin.get({ key: LAST_USER_KEY });
      return value || null;
    } catch {
      return null;
    }
  }

  async clearToken(): Promise<void> {
    for (const key of [TOKEN_KEY, LAST_USER_KEY]) {
      try {
        await SecureStoragePlugin.remove({ key });
      } catch {
        // No-op: si no existía, no hay nada que borrar
      }
    }
  }
}
