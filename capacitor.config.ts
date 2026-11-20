import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // TODO: reemplazar por el appId real antes de publicar en stores
  // (ej. 'mx.bestcare.app'). 'io.ionic.starter' es solo el valor por defecto.
  appId: 'io.ionic.starter',
  appName: 'best-care',
  webDir: 'www',
  server: {
    // Fuerza esquema https dentro del WebView en Android (requerido por
    // muchos backends que validan el header Origin/Referer).
    androidScheme: 'https',
  },
  plugins: {
    // CapacitorHttp DESHABILITADO temporalmente: el backend
    // (bigback.bestclinic.io) envía un header Content-Security-Policy mal
    // formado (usa comas en vez de punto y coma entre directivas), y el
    // puente nativo Android de CapacitorHttp lo corrompe al reconstruirlo
    // como objeto de headers para JS, generando nombres de header inválidos
    // (ej. "", "    https"). Cuando el navegador intenta construir un
    // Response/Headers real con esos nombres, lanza
    // "Failed to construct 'Response': Invalid name", y Angular lo reporta
    // como status 0 aunque la petición nativa sí obtuvo 200 con el JSON
    // correcto (visible en los logs de Capacitor/Console).
    //
    // Como el backend ya responde "Access-Control-Allow-Origin: *", el
    // WebView nativo (Chromium) puede hacer estas peticiones directamente
    // sin pasar por el puente de CapacitorHttp, evitando el bug.
    //
    // TODO: pedir al equipo de backend que corrija el header
    // Content-Security-Policy (usar ";" entre directivas, no ",") y que lo
    // quiten de las respuestas de /api/v2/* (un API JSON no necesita CSP).
    // Una vez corregido en el backend, se puede volver a poner enabled:true
    // si se necesita por algún otro motivo de CORS.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
