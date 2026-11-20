// src/app/core/interceptors/error.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiException } from '../services/api.service';

/**
 * Convierte cualquier error HTTP (de red o del backend Bigback) en una
 * ApiException homogénea, con un mensaje ya listo para mostrarse al usuario.
 *
 * status === 0        -> sin conexión / CORS / servidor caído
 * status === 401/403   -> token inválido o expirado
 * status === 404       -> recurso no encontrado (ej: paciente inexistente)
 * status >= 500        -> error del servidor
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const backendMessage: string | undefined =
        error.error?.message || error.error?.error || error.error?.detail;

      let mensaje = backendMessage ?? 'Ocurrió un error al comunicarnos con el servidor.';

      if (error.status === 0) {
        mensaje = 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
      } else if (error.status === 401 || error.status === 403) {
        mensaje = backendMessage ?? 'Tu sesión no es válida. Inicia sesión nuevamente.';
      } else if (error.status === 404) {
        mensaje = backendMessage ?? 'No se encontró la información solicitada.';
      } else if (error.status >= 500) {
        mensaje = 'El servidor de Best Care no está disponible en este momento. Intenta más tarde.';
      }

      return throwError(() => new ApiException(error.status, backendMessage ?? 'API_ERROR', mensaje));
    }),
  );
};
