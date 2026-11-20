// src/app/core/services/auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user.model';
import { ApiService, ApiException, isTransientError } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { PatientDataService } from './patient-data.service';
import { PerfTimer, startPerfTimer } from '../utils/perf.util';
import {
  AuthRequest,
  AuthResponse,
  CreatePatientRequest,
  FhirPatient,
  RecoverPasswordRequest,
} from '../models/api-dto.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  /** Token vigente; útil para que otras pantallas (perfil) llamen /patient/update */
  authToken = signal<string | null>(null);

  private router = inject(Router);
  private api = inject(ApiService);
  private tokenStorage = inject(TokenStorageService);
  private patientData = inject(PatientDataService);

  /**
   * Se llama una vez al arrancar la app (ver app.component.ts).
   * Si hay un auth_token guardado en el dispositivo, intenta validar la
   * sesión trayendo el perfil.
   *
   *  - Token inválido / respuesta de error de Bigback -> limpia la sesión.
   *  - Problema de CONEXIÓN (sin red, timeout, 5xx) -> NO cierra la sesión:
   *    un error de red no significa que el token sea inválido. Se abre la app
   *    con los datos de la caché local del dispositivo, si existen. Antes,
   *    abrir la app sin internet borraba el token y obligaba a volver a
   *    iniciar sesión.
   */
  async restoreSession(): Promise<void> {
    const perf = startPerfTimer('restoreSession');
    const token = await this.tokenStorage.getToken();
    perf.lap('leer token (SecureStorage)');
    if (!token) {
      perf.end('sin token guardado');
      return;
    }

    try {
      this.authToken.set(token);
      await this.loadProfile(token, perf);
      this.router.navigateByUrl('/tabs/inicio', { replaceUrl: true });
      perf.end('resultado=sesión restaurada');
    } catch (err) {
      if (isTransientError(err)) {
        const restored = await this.restoreFromDeviceCache();
        perf.lap('modo sin conexión (caché)');
        if (restored) {
          this.router.navigateByUrl('/tabs/inicio', { replaceUrl: true });
          perf.end('resultado=SIN CONEXIÓN · abierta con datos de la caché · sesión conservada');
        } else {
          // Sin conexión y sin caché: se conserva el token para el próximo intento.
          perf.end('resultado=sin conexión y sin caché · sesión conservada');
        }
        return;
      }
      await this.clearSession();
      perf.end('resultado=sesión descartada (token inválido o respuesta de error)');
    }
  }

  /** POST /api/v2/patient/create, seguido de login automático */
  async register(
    firstName: string,
    lastName: string,
    correo: string,
    phone: string,
    password: string,
    documentType?: string,
    documentId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const body: CreatePatientRequest = {
        first_name: firstName,
        last_name: lastName,
        correo,
        phone,
        password,
        document_type: documentType,
        document_id: documentId,
      };
      await this.api.post('/patient/create', body);
      // El endpoint de creación no retorna token en la colección de Postman,
      // así que iniciamos sesión inmediatamente después de crear la cuenta.
      const loginResult = await this.login(correo, password);
      return loginResult;
    } catch (err) {
      // api.post lanza ApiException con el code/message reales de Bigback
      // (ej. code "005" -> "Ya existe un paciente registrado con este correo").
      return { ok: false, error: this.messageFor(err) };
    }
  }

  /** POST /api/v2/patient/auth */
  async login(correo: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const perf = startPerfTimer('login');
      const body: AuthRequest = { correo, password };
      const res = await this.api.post<AuthResponse>('/patient/auth', body);
      perf.lap('/patient/auth (red)');
      const token = res?.auth_token;
      if (!token) {
        // La petición "tuvo éxito" en apariencia pero no trajo token: no
        // debería pasar una vez que unwrapJsonRpc esté funcionando bien,
        // pero se deja como salvaguarda para no dejar la UI sin mensaje.
        return { ok: false, error: 'No se pudo iniciar sesión. Intenta de nuevo.' };
      }

      await this.tokenStorage.setToken(token);
      perf.lap('guardar token (SecureStorage)');
      this.authToken.set(token);
      await this.loadProfile(token, perf);

      this.router.navigateByUrl('/tabs/inicio', { replaceUrl: true });
      perf.end();
      return { ok: true };
    } catch (err) {
      // api.post lanza ApiException con el code/message reales de Bigback
      // (ej. code "014" -> "Credenciales inválidas").
      return { ok: false, error: this.messageFor(err) };
    }
  }

  /** POST /api/v2/patient/me (Accept: application/fhir+json) */
  private async loadProfile(token: string, perf?: PerfTimer): Promise<void> {
    const response = await this.api.post<unknown>(
      '/patient/me',
      { auth_token: token },
      // Es una lectura: se reintenta 1 vez ante fallas transitorias de red/servidor.
      { fhir: true, retries: 1 },
    );
    perf?.lap('/patient/me (red)');
    const fhirPatient = this.toFhirPatient(response);
    const userId = fhirPatient.id ?? 'me';
    // Para poder abrir la app sin conexión con los datos de la caché.
    void this.tokenStorage.setLastUserId(userId);

    this.currentUser.set({
      id: userId,
      email: fhirPatient.telecom?.find((t) => t.system === 'email')?.value ?? '',
      status: 'active',
      createdAt: fhirPatient.meta?.lastUpdated ?? new Date().toISOString(),
      updatedAt: fhirPatient.meta?.lastUpdated ?? new Date().toISOString(),
    });

    this.patientData.setFromFhir(fhirPatient, userId);

    // Alergias/medicamentos/diagnósticos/contactos de emergencia todavía
    // no se leen de vuelta desde Bigback (fhirPatientToMedicalRecord los
    // deja en [] siempre, ver ese archivo); se recuperan del caché local
    // del dispositivo para que no "desaparezcan" en cada login o
    // restauración de sesión. Ver PatientDataService.hydrateLocalCollections.
    await this.patientData.hydrateLocalCollections(userId);
    perf?.lap('caché local (hydrate)');
  }

  /**
   * /patient/me se pide con Accept: application/fhir+json, así que
   * ApiService NO le aplica unwrapJsonRpc. Si Bigback contesta un error con
   * HTTP 200 (envoltorio JSON-RPC o un OperationOutcome), antes se trataba
   * como un Patient válido y la app "iniciaba sesión" con un perfil vacío.
   * Aquí se exige resourceType === 'Patient'; si no, se lanza una
   * ApiException (status 200 => NO transitoria => la sesión se descarta).
   */
  private toFhirPatient(res: unknown): FhirPatient {
    const r = (res ?? {}) as {
      resourceType?: unknown;
      result?: { code?: unknown; message?: unknown };
      issue?: { code?: unknown; diagnostics?: unknown; details?: { text?: unknown } }[];
    };
    if (r.resourceType === 'Patient') return r as unknown as FhirPatient;

    const firstString = (...values: unknown[]): string | undefined =>
      values.find((v): v is string => typeof v === 'string' && v.length > 0);
    const issue = r.issue?.[0];
    const message =
      firstString(r.result?.message, issue?.diagnostics, issue?.details?.text) ??
      'No se pudo cargar tu perfil. Inicia sesión nuevamente.';
    const code = firstString(r.result?.code, issue?.code) ?? 'INVALID_PROFILE';
    throw new ApiException(200, code, message);
  }

  /** Modo sin conexión: perfil y registro médico desde la caché del dispositivo. */
  private async restoreFromDeviceCache(): Promise<boolean> {
    const userId = await this.tokenStorage.getLastUserId();
    if (!userId) return false;
    const ok = await this.patientData.restoreFromCache(userId);
    if (!ok) return false;

    const now = new Date().toISOString();
    this.currentUser.set({ id: userId, email: '', status: 'active', createdAt: now, updatedAt: now });
    return true;
  }

  /** Cierra sesión: borra el token del almacenamiento seguro y el estado local */
  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  private async clearSession(): Promise<void> {
    await this.tokenStorage.clearToken();
    this.authToken.set(null);
    this.currentUser.set(null);
    this.patientData.clear();
  }

  /**
   * POST /api/v2/patient/recover-password
   *
   * ⚠️ SIN CONFIRMAR CON BACKEND (mismo caso que loginWithNip más abajo):
   * no existe, en la colección de Postman "Paciente Bigback" entregada
   * hasta ahora, un endpoint de recuperación de contraseña. Se apuesta
   * por seguir la misma convención que create/auth/update (ruta bajo
   * /patient/, campo "correo" en el body) porque es lo más consistente
   * con el resto de la API, PERO la ruta real podría ser otra
   * (/patient/forgot-password, /patient/reset-password, etc.) o requerir
   * un segundo paso con código de verificación + nueva contraseña.
   *
   * TODO(backend): confirmar con el equipo de Bigback la ruta exacta, el
   * payload esperado, y si el flujo es de un solo paso (enlace al correo)
   * o de dos pasos (código + nueva contraseña) — y ajustar aquí. También
   * conviene confirmar si, por seguridad, Bigback ya responde siempre
   * "éxito" sin importar si el correo existe (para no revelar cuentas
   * registradas); si no lo hace, considerar homogeneizar ese mensaje acá.
   */
  async requestPasswordRecovery(correo: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const body: RecoverPasswordRequest = { correo };
      await this.api.post('/patient/recover-password', body);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.messageFor(err) };
    }
  }

  // --- Login con NIP / biometría --------------------------------------
  // Estos flujos NO aparecen en la colección de Postman entregada
  // (no existe /patient/auth-nip ni endpoint biométrico). Se mantienen
  // simulados a propósito para no bloquear la UI ya construida; deben
  // reemplazarse en cuanto el backend publique esos endpoints.

  async loginWithNip(nip: string): Promise<boolean> {
    // TODO: reemplazar por POST /api/v2/patient/auth-nip cuando exista
    return !!nip && nip.length >= 4;
  }

  async loginWithBiometrics(): Promise<boolean> {
    // TODO: integrar @capacitor-community/biometric-auth + endpoint real
    return this.loginWithNip('0000');
  }

  private messageFor(err: unknown): string {
    if (err instanceof ApiException) return err.message;
    return 'Ocurrió un error inesperado.';
  }
}
