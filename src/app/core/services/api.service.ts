// src/app/core/services/api.service.ts
import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, map, throwError, retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Bigback (REST v2, no-FHIR) responde SIEMPRE con HTTP 200, incluso cuando
 * la operación falla. El resultado real viaja envuelto estilo JSON-RPC, y
 * la forma cambia según sea éxito o error:
 *
 *   Éxito: { "jsonrpc": "2.0", "id": null,
 *            "result": { "code": "100", "response": "Paciente creado exitosamente",
 *                         "data": { "id": 11, ..., "auth_token": "..." } } }
 *
 *   Error: { "jsonrpc": "2.0", "id": null,
 *            "result": { "code": "014", "message": "Credenciales inválidas" } }
 *
 * La señal confiable no es el código (podría haber más de un código de
 * éxito), sino la FORMA: los errores traen "message" y nunca "data"; los
 * éxitos traen "data" (el payload real) y "response" en vez de "message".
 */
interface JsonRpcSuccessResult<T> {
  code: string;
  response?: string;
  data: T;
}

interface JsonRpcErrorResult {
  code: string;
  message: string;
}

interface JsonRpcEnvelope<T> {
  jsonrpc?: string;
  id?: unknown;
  result?: JsonRpcSuccessResult<T> | JsonRpcErrorResult | T;
}

function isJsonRpcError(result: unknown): result is JsonRpcErrorResult {
  return (
    !!result &&
    typeof result === 'object' &&
    'message' in result &&
    !('data' in result)
  );
}

function hasDataEnvelope<T>(result: unknown): result is JsonRpcSuccessResult<T> {
  return !!result && typeof result === 'object' && 'data' in result;
}

/** Error homogéneo generado por el errorInterceptor (o por timeout) a partir de fallas HTTP. */
export class ApiException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

/** Tiempo máximo de espera antes de abortar una petición y mostrar error al usuario. */
const REQUEST_TIMEOUT_MS = 15000;

/** Espera antes de reintentar una petición que falló por un problema transitorio. */
const RETRY_DELAY_MS = 800;

/**
 * ¿El error es transitorio (sin red, timeout, 408, 429 o 5xx)? Sirve para:
 *  - decidir si vale la pena reintentar una lectura, y
 *  - NO cerrar la sesión del usuario por un problema de conexión (ver
 *    AuthService.restoreSession): un error de red no significa que el token
 *    sea inválido.
 * Los errores de negocio de Bigback (JSON-RPC con HTTP 200) y 401/403/404
 * NO son transitorios.
 */
export function isTransientError(err: unknown): boolean {
  return (
    err instanceof ApiException &&
    (err.status === 0 || err.status === 408 || err.status === 429 || err.status >= 500)
  );
}

/**
 * Wrapper delgado sobre HttpClient para hablar con:
 *  - REST v2  -> https://bigback.bestclinic.io/api/v2/...
 *  - FHIR     -> https://bigback.bestclinic.io/fhir/...
 *
 * Nota importante: la colección de Postman muestra que Bigback usa
 * "auth_token" viajando en el BODY del POST (no como header
 * Authorization: Bearer ...). Por eso cada servicio de dominio
 * (AuthService, PatientDataService) agrega el auth_token al payload,
 * y este wrapper solo se encarga de la URL base y el manejo de errores.
 *
 * Todas las peticiones tienen un timeout de REQUEST_TIMEOUT_MS: si el
 * servidor/red no responde en ese lapso, se lanza ApiException con
 * status 0 en vez de dejar la UI esperando indefinidamente (spinner
 * infinito).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private zone = inject(NgZone);

  /**
   * `opts.retries`: reintentos ante fallas TRANSITORIAS de red/servidor (ver
   * isTransientError). Úsalo solo en lecturas o en operaciones idempotentes
   * (ej. /patient/me), nunca en creaciones. Un timeout NO se reintenta, para
   * no duplicar la espera de 15 s.
   */
  post<T>(path: string, body: unknown, opts?: { fhir?: boolean; retries?: number }): Promise<T> {
    const url = `${environment.apiUrl}${path}`;
    const headers = opts?.fhir
      ? new HttpHeaders({ Accept: 'application/fhir+json' })
      : undefined;
    return this.runInZone(
      firstValueFrom(
        this.http.post<T | JsonRpcEnvelope<T>>(url, body, { headers }).pipe(
          timeout(REQUEST_TIMEOUT_MS),
          retry({
            count: opts?.retries ?? 0,
            delay: (err) => (isTransientError(err) ? timer(RETRY_DELAY_MS) : throwError(() => err)),
          }),
          map((raw) => (opts?.fhir ? (raw as T) : this.unwrapJsonRpc<T>(raw as JsonRpcEnvelope<T>))),
          catchError((err) => this.toApiException(err)),
        ),
      ),
    );
  }

  /**
   * Bigback responde 200 aunque la operación falle; el resultado real (o el
   * error) viene dentro de "result". Aquí se detecta ese caso y se convierte
   * en una ApiException con el "code"/"message" reales del backend, para que
   * ni AuthService ni la UI se queden esperando algo que nunca va a llegar.
   *
   * Éxito -> se devuelve result.data (ahí vive el auth_token, id, etc).
   * Error -> se lanza ApiException con result.code / result.message reales.
   */
  private unwrapJsonRpc<T>(raw: JsonRpcEnvelope<T> | T): T {
    const result = (raw as JsonRpcEnvelope<T>)?.result;
    if (result === undefined) {
      // No viene envuelto (o ya es el dato final): se devuelve tal cual.
      return raw as T;
    }
    if (isJsonRpcError(result)) {
      throw new ApiException(200, result.code, result.message ?? 'Ocurrió un error inesperado.');
    }
    if (hasDataEnvelope<T>(result)) {
      return result.data;
    }
    // Forma no esperada (ni "message" ni "data"): se devuelve tal cual por
    // compatibilidad, en vez de asumir que es un error.
    return result as T;
  }

  getFhir<T>(path: string): Promise<T> {
    const url = `${environment.fhirUrl}${path}`;
    return this.runInZone(
      firstValueFrom(
        this.http.get<T>(url).pipe(
          timeout(REQUEST_TIMEOUT_MS),
          catchError((err) => this.toApiException(err)),
        ),
      ),
    );
  }

  /**
   * Con CapacitorHttp habilitado (capacitor.config.ts), fetch()/XHR se
   * enrutan por el puente nativo de Android/iOS. Ese puente resuelve la
   * promesa FUERA de la Angular Zone (no pasa por las tareas que zone.js
   * parchea), así que Angular nunca dispara detección de cambios cuando
   * el .then()/await de esta promesa continúa. Resultado observado: la
   * lógica sí corre (submitting = false, etc.) pero la UI no se repinta y
   * parece "quedarse cargando" con el spinner congelado.
   *
   * Este helper reingresa explícitamente a la Angular Zone antes de
   * resolver/rechazar, para que cualquier código que haga
   * `await apiService.post(...)` dispare detección de cambios normalmente.
   */
  private runInZone<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      promise.then(
        (val) => this.zone.run(() => resolve(val)),
        (err) => this.zone.run(() => reject(err)),
      );
    });
  }

  private toApiException(err: unknown) {
    // El errorInterceptor ya convierte errores HTTP en ApiException.
    // Este catch adicional cubre el caso de timeout (rxjs TimeoutError),
    // que no pasa por el interceptor porque no es un error HTTP.
    if (err instanceof ApiException) {
      return throwError(() => err);
    }
    return throwError(
      () =>
        new ApiException(
          0,
          'TIMEOUT',
          'El servidor no respondió a tiempo. Verifica tu conexión e intenta de nuevo.',
        ),
    );
  }
}
