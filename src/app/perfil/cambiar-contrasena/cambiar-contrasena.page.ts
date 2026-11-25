// src/app/perfil/cambiar-contrasena/cambiar-contrasena.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonIcon,
  IonSpinner,
  IonText,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { PatientDataService } from '../../core/services/patient-data.service';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-cambiar-contrasena',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonIcon,
    IonSpinner,
    IonText,
  ],
  templateUrl: './cambiar-contrasena.page.html',
  styleUrls: ['./cambiar-contrasena.page.scss'],
})
export class CambiarContrasenaPage {
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;

  submitting = signal(false);
  errorMessage = signal('');

  constructor(
    private authService: AuthService,
    private patientData: PatientDataService,
    private modalController: ModalController,
    private toastController: ToastController,
  ) {
    addIcons({ arrowBackOutline, lockClosedOutline, eyeOutline, eyeOffOutline });
  }

  async onSave() {
    this.errorMessage.set('');

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage.set('Completa ambos campos para continuar.');
      return;
    }
    if (this.newPassword.length < MIN_PASSWORD_LENGTH) {
      this.errorMessage.set(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    const token = this.authService.authToken();
    if (!token) {
      this.errorMessage.set('Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.patientData.updateProfile(token, { password: this.newPassword });
      this.newPassword = '';
      this.confirmPassword = '';

      const toast = await this.toastController.create({
        message: 'Contraseña actualizada correctamente.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

      await this.goBack();
    } catch (err) {
      console.error('[BestCare][cambiar-contrasena] update falló', err);
      this.errorMessage.set(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo actualizar la contraseña. Intenta de nuevo.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async goBack() {
    await this.modalController.dismiss();
  }
}
