import { Component, OnInit, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AuthService } from './core/services/auth.service';
import { SplashScreenComponent } from './splash/splash-screen.component';
import { perfLog } from './core/utils/perf.util';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, SplashScreenComponent],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);

  /** Controla la visibilidad del splash de bienvenida al arrancar la app. */
  showSplash = signal(true);

  /** Tiempo mínimo (ms) que se muestra el splash, para que no "parpadee". */
  private readonly minSplashDurationMs = 1200;

  ngOnInit(): void {
    const t0 = performance.now();
    const minDelay = new Promise((resolve) => setTimeout(resolve, this.minSplashDurationMs));

    // Si hay un auth_token guardado (SecureStoragePlugin) de una sesión
    // previa, lo valida contra /patient/me y redirige a /tabs/inicio.
    const restoring = this.authService
      .restoreSession()
      .finally(() => perfLog('ARRANQUE · restoreSession completo', t0));

    Promise.all([restoring, minDelay])
      .catch(() => undefined)
      .finally(() => {
        perfLog('ARRANQUE · splash oculto (lo que ve el usuario)', t0);
        this.showSplash.set(false);
      });
  }
}
