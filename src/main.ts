import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';
import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { errorInterceptor } from './app/core/interceptors/error.interceptor';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Necesario para que el DatePipe pueda formatear fechas con locale 'es-MX'
// (usado en perfil.page.html). Sin esto, Angular lanza NG02100 /
// "Missing locale data for the locale es-MX" en cualquier pipe date que
// especifique ese locale.
registerLocaleData(localeEsMx, 'es-MX');

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor])),
  ],
});