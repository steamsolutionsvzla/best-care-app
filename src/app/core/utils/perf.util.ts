// src/app/core/utils/perf.util.ts
//
// Mediciones de tiempo TEMPORALES para comparar el arranque/login antes y
// después de optimizar la caché local. Todo sale con el prefijo
// "[BestCare][perf]" para filtrarlo fácil en Logcat (Android Studio) o en la
// consola de Safari/Chrome (inspect del WebView).
//
// Para apagarlo por completo: PERF_LOGS_ENABLED = false.

export const PERF_LOGS_ENABLED = true;

const PREFIX = '[BestCare][perf]';

export interface PerfTimer {
  /** Marca un paso: guarda el tiempo transcurrido desde la marca anterior. */
  lap(name: string): void;
  /** Imprime el total y el detalle de cada paso. */
  end(extra?: string): void;
}

export function startPerfTimer(label: string): PerfTimer {
  const t0 = performance.now();
  let last = t0;
  const laps: string[] = [];

  return {
    lap(name: string) {
      const now = performance.now();
      laps.push(`${name}=${Math.round(now - last)}ms`);
      last = now;
    },
    end(extra?: string) {
      if (!PERF_LOGS_ENABLED) return;
      const total = Math.round(performance.now() - t0);
      const detail = laps.length ? ` | ${laps.join(' · ')}` : '';
      console.log(`${PREFIX} ${label}: TOTAL=${total}ms${detail}${extra ? ` | ${extra}` : ''}`);
    },
  };
}

export function perfLog(label: string, sinceMs: number): void {
  if (!PERF_LOGS_ENABLED) return;
  console.log(`${PREFIX} ${label}: ${Math.round(performance.now() - sinceMs)}ms`);
}
