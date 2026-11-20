// src/app/splash/splash-screen.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { medicalOutline } from 'ionicons/icons';

/**
 * Splash de bienvenida mostrado mientras arranca la app (carga de Angular
 * + validación de sesión). Se oculta con un fundido controlado por
 * AppComponent a través del input `hide`.
 */
@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="splash" [class.splash--hide]="hide">
      <div class="splash__mark">
        <div class="splash__ring"></div>
        <ion-icon name="medical-outline"></ion-icon>
      </div>
      <h1 class="splash__title">BEST CARE</h1>
      <p class="splash__subtitle">Sistema de Salud Digital</p>
      <div class="splash__spinner"><span></span><span></span><span></span></div>
    </div>
  `,
  styleUrls: ['./splash-screen.component.scss'],
})
export class SplashScreenComponent {
  @Input() hide = false;

  constructor() {
    addIcons({ medicalOutline });
  }
}
