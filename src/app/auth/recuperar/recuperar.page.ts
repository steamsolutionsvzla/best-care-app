// src/app/auth/recuperar/recuperar.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonButton, IonText, IonInput, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  mailOutline,
  lockOpenOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  paperPlaneOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

/**
 * Pantalla de "Recuperar contraseña", enlazada desde login.page.html
 * (antes el link "Recuperar" no tenía ningún handler: era
 * `<a href="javascript:void(0)">`).
 *
 * ⚠️ SIN CONFIRMAR CON BACKEND: usa AuthService.requestPasswordRecovery(),
 * que apuesta por un endpoint /patient/recover-password que no está
 * confirmado en la colección de Postman entregada (ver el comentario
 * completo en auth.service.ts). Mientras eso se confirma, esta pantalla
 * asume el flujo más simple y común (un solo paso: se envían
 * instrucciones al correo) en vez de un segundo paso con código de
 * verificación. Si Bigback termina siendo un flujo de 2 pasos, hay que
 * agregar aquí un segundo formulario (código + nueva contraseña) — el
 * botón "Enviar instrucciones" y el mensaje de éxito son lo único que
 * habría que ajustar, el resto de la pantalla no cambia.
 */
@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IonContent, IonIcon, IonButton, IonText, IonInput, IonSpinner],
  templateUrl: './recuperar.page.html',
  styleUrls: ['./recuperar.page.scss'],
})
export class RecuperarPage {
  email = '';
  submitting = signal(false);
  errorMessage = signal('');
  /** true una vez que la petición se envió correctamente (muestra la pantalla de confirmación). */
  sent = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    addIcons({
      mailOutline,
      lockOpenOutline,
      arrowBackOutline,
      checkmarkCircleOutline,
      paperPlaneOutline,
    });
  }

  async onSubmit() {
    this.errorMessage.set('');

    const correo = this.email.trim();
    if (!correo) {
      this.errorMessage.set('Ingresa tu correo electrónico.');
      return;
    }
    // Validación simple del formato, no exhaustiva: solo evita el caso
    // más común de error de tipeo antes de llamar a la API.
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    if (!looksLikeEmail) {
      this.errorMessage.set('Ingresa un correo electrónico válido.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.authService.requestPasswordRecovery(correo);
      if (result.ok) {
        this.sent.set(true);
      } else {
        this.errorMessage.set(result.error ?? 'No se pudo enviar la solicitud. Intenta de nuevo.');
      }
    } catch {
      this.errorMessage.set('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }

  goToLogin() {
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
