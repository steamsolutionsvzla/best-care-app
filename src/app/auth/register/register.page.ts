// src/app/auth/register/register.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personAddOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = signal('');
  submitting = signal(false);
  showPassword = false;
  showConfirmPassword = false;

  constructor(private authService: AuthService) {
    addIcons({
      personAddOutline,
      mailOutline,
      lockClosedOutline,
      eyeOutline,
      eyeOffOutline,
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async onRegister() {
    this.errorMessage.set('');

    if (!this.email.trim() || !this.password || !this.confirmPassword) {
      this.errorMessage.set('Completa todos los campos para continuar.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }
    if (this.password.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.submitting.set(true);
    try {
      // shortcut: AuthService.register still requires firstName/lastName/phone, update when backend drops them
      const result = await this.authService.register(
        '',
        '',
        this.email.trim(),
        '',
        this.password,
      );
      if (!result.ok) {
        this.errorMessage.set(result.error ?? 'No se pudo crear la cuenta. Intenta nuevamente.');
      }
    } catch {
      // Salvaguarda por si ocurre un error no contemplado por AuthService.register
      this.errorMessage.set('No se pudo conectar con el servidor. Intenta de nuevo.');
    } finally {
      this.submitting.set(false);
    }
  }
}
