// src/app/auth/register/register.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
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
  personOutline,
  callOutline,
  eyeOutline,
  eyeOffOutline,
  idCardOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { DocumentType } from '../../core/models/patient-profile.model';

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
    IonSelect,
    IonSelectOption,
    IonButton,
    IonText,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  firstName = '';
  lastName = '';
  documentType: DocumentType = 'V';
  documentId = '';
  phone = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = signal('');
  submitting = signal(false);
  showPassword = false;
  showConfirmPassword = false;

  /**
   * Bug: el "Tipo" de documento vive en un <ion-item> angosto a propósito
   * (doc-row__type, 92px, junto a "Cédula"). El popover de ion-select por
   * defecto usa `size: 'cover'`, es decir, toma el mismo ancho que el
   * elemento que lo dispara — por eso salía un recuadro en blanco: el
   * popover se abría con ~92px de ancho, insuficiente para el radio-list
   * con "V (Venezolano)" etc., y su contenido quedaba recortado/invisible.
   * `size: 'auto'` hace que el popover mida según su propio contenido en
   * vez del elemento que lo abrió.
   */
  documentTypePopoverOptions = { size: 'auto' as const };

  constructor(private authService: AuthService) {
    addIcons({
      personAddOutline,
      mailOutline,
      lockClosedOutline,
      personOutline,
      callOutline,
      eyeOutline,
      eyeOffOutline,
      idCardOutline,
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

    if (!this.firstName || !this.lastName || !this.phone || !this.email) {
      this.errorMessage.set('Completa todos los campos para continuar.');
      return;
    }
    if (!this.documentId.trim()) {
      this.errorMessage.set('Ingresa tu número de cédula.');
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
      const result = await this.authService.register(
        this.firstName,
        this.lastName,
        this.email,
        this.phone,
        this.password,
        this.documentType,
        this.documentId.trim(),
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
