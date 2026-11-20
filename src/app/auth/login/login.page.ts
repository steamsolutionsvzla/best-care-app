// src/app/auth/login/login.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonText,
  IonInput,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  medicalOutline,
  lockClosedOutline,
  mailOutline,
  eyeOutline,
  eyeOffOutline,
  logInOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonIcon,
    IonButton,
    IonText,
    IonInput,
    IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = '';
  password = '';
  showPassword = false;
  submitting = signal(false);

  errorMessage = signal('');

  constructor(private authService: AuthService) {
    addIcons({
      medicalOutline,
      lockClosedOutline,
      mailOutline,
      eyeOutline,
      eyeOffOutline,
      logInOutline,
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onLogin() {
    this.errorMessage.set('');

    if (!this.email || !this.password) {
      this.errorMessage.set('Ingresa tu correo y contraseña para continuar.');
      return;
    }

    this.submitting.set(true);
    try {
      const result = await this.authService.login(this.email, this.password);
      if (!result.ok) {
        // Mensaje real que devuelve Bigback (ej. "Credenciales inválidas"),
        // con un fallback genérico solo si no vino ninguno.
        this.errorMessage.set(result.error ?? 'Correo o contraseña incorrectos.');
      }
    } catch {
      // Salvaguarda por si ocurre un error no contemplado por AuthService.login
      this.errorMessage.set('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }
}
