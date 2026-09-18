import { Component, inject, computed, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { GuestService } from '../../services/guest.service';
import { TableService } from '../../services/table.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private guestService = inject(GuestService);
  private tableService = inject(TableService);
  private authService = inject(AuthService);

  /** Value shared across the app */
  maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);
  totalEstimatedGuests = computed(
    () => this.settingsService.settings().total_estimated_guests || 0,
  );
  autoAssignTables = computed(() => this.settingsService.settings().auto_assign_tables ?? false);
  enableHighchairs = computed(() => this.settingsService.settings().enable_highchairs ?? false);
  enableWhatsApp = computed(() => this.settingsService.settings().enable_whatsapp ?? false);
  whatsAppApikey = computed(() => this.settingsService.settings().whatsapp_apikey ?? '');
  whatsAppPhone = computed(() => this.settingsService.settings().whatsapp_phone ?? '');

  // Delete all guests modal + captcha + email code
  showDeleteAllModal = signal(false);
  captchaQuestion = signal('');
  captchaAnswer = signal('');
  deleteCode = signal('');
  deleteError = signal<string | null>(null);
  isDeleting = signal(false);
  private correctCaptchaAnswer = 0;

  // Delete all tables modal + captcha + email code
  showDeleteAllTablesModal = signal(false);
  captchaQuestionTables = signal('');
  captchaAnswerTables = signal('');
  deleteCodeTables = signal('');
  deleteErrorTables = signal<string | null>(null);
  isDeletingTables = signal(false);
  private correctCaptchaAnswerTables = 0;

  // Password reset via email verification code
  isRequestingResetCode = signal(false);
  codeRequested = signal(false);
  resetCode = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  showNewPassword = signal(false);
  resetSuccessMessage = signal<string | null>(null);
  resetErrorMessage = signal<string | null>(null);
  isSubmittingReset = signal(false);

  // Change account email
  currentEmail = signal<string | null>(null);
  isLoadingEmail = signal(false);
  newEmail = signal('');
  emailCurrentPassword = signal('');
  showEmailCurrentPassword = signal(false);
  isSubmittingEmail = signal(false);
  emailSuccessMessage = signal<string | null>(null);
  emailErrorMessage = signal<string | null>(null);

  ngOnInit() {
    this.settingsService.loadSettings().subscribe();
    this.loadCurrentEmail();
  }

  private loadCurrentEmail() {
    this.isLoadingEmail.set(true);
    this.authService.fetchMyProfile().subscribe({
      next: (res) => {
        this.isLoadingEmail.set(false);
        if (res?.user?.email !== undefined) {
          this.currentEmail.set(res.user.email);
        }
      },
      error: (err) => {
        this.isLoadingEmail.set(false);
        // No bloqueamos la página: la sección simplemente no mostrará
        // el email actual si el endpoint falla.
        console.warn('[settings] No se pudo cargar el email actual:', err);
      },
    });
  }

  updateMaxGuests(val: number) {
    this.settingsService.updateMaxGuests(val).subscribe();
  }

  updateTotalEstimatedGuests(val: number) {
    this.settingsService.updateTotalEstimatedGuests(val).subscribe();
  }

  toggleAutoAssignTables(enabled: boolean) {
    this.settingsService.updateAutoAssignTables(enabled).subscribe();
  }

  toggleEnableHighchairs(enabled: boolean) {
    this.settingsService.updateEnableHighchairs(enabled).subscribe();
  }

  toggleEnableWhatsApp(enabled: boolean) {
    this.settingsService.updateEnableWhatsApp(enabled).subscribe();
  }

  updateWhatsAppApikey(value: string) {
    this.settingsService.updateWhatsAppApikey(value).subscribe();
  }

  updateWhatsAppPhone(value: string) {
    this.settingsService.updateWhatsAppPhone(value).subscribe();
  }

  // --- Delete All Guests ---
  async openDeleteAllModal() {
    this.generateCaptcha();
    this.captchaAnswer.set('');
    this.deleteCode.set('');
    this.deleteError.set(null);

    try {
      // ask backend to email a code
      await this.guestService.requestDeleteCode();
    } catch (err) {
      console.error('Error requesting delete code:', err);
      this.deleteError.set('No se pudo solicitar el código. Intenta de nuevo más tarde.');
    }

    this.showDeleteAllModal.set(true);
  }

  closeDeleteAllModal() {
    this.showDeleteAllModal.set(false);
  }

  private generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    this.correctCaptchaAnswer = num1 + num2;
    this.captchaQuestion.set(`${num1} + ${num2}`);
  }

  async confirmDeleteAll() {
    const userAnswer = parseInt(this.captchaAnswer(), 10);
    if (userAnswer !== this.correctCaptchaAnswer) {
      this.deleteError.set('CAPTCHA incorrecto. Inténtalo de nuevo.');
      this.generateCaptcha();
      this.captchaAnswer.set('');
      return;
    }

    if (!this.deleteCode()) {
      this.deleteError.set('Introduce el código enviado por email.');
      return;
    }

    this.isDeleting.set(true);
    this.deleteError.set(null);
    try {
      await this.guestService.deleteAllGuests(this.deleteCode());
      this.showDeleteAllModal.set(false);
    } catch (error) {
      console.error('Error deleting all guests:', error);
      this.deleteError.set('Error al eliminar los invitados. Inténtalo de nuevo.');
    } finally {
      this.isDeleting.set(false);
    }
  }

  // --- Delete All Tables ---
  async openDeleteAllTablesModal() {
    this.generateCaptchaTables();
    this.captchaAnswerTables.set('');
    this.deleteCodeTables.set('');
    this.deleteErrorTables.set(null);

    try {
      // ask backend to email a code
      await this.tableService.requestDeleteCode();
    } catch (err) {
      console.error('Error requesting delete code for tables:', err);
      this.deleteErrorTables.set('No se pudo solicitar el código. Intenta de nuevo más tarde.');
    }

    this.showDeleteAllTablesModal.set(true);
  }

  closeDeleteAllTablesModal() {
    this.showDeleteAllTablesModal.set(false);
  }

  private generateCaptchaTables() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    this.correctCaptchaAnswerTables = num1 + num2;
    this.captchaQuestionTables.set(`${num1} + ${num2}`);
  }

  async confirmDeleteAllTables() {
    const userAnswer = parseInt(this.captchaAnswerTables(), 10);
    if (userAnswer !== this.correctCaptchaAnswerTables) {
      this.deleteErrorTables.set('CAPTCHA incorrecto. Inténtalo de nuevo.');
      this.generateCaptchaTables();
      this.captchaAnswerTables.set('');
      return;
    }

    if (!this.deleteCodeTables()) {
      this.deleteErrorTables.set('Introduce el código enviado por email.');
      return;
    }

    this.isDeletingTables.set(true);
    this.deleteErrorTables.set(null);
    try {
      await this.tableService.deleteAllTables(this.deleteCodeTables());
      this.showDeleteAllTablesModal.set(false);
    } catch (error) {
      console.error('Error deleting all tables:', error);
      this.deleteErrorTables.set('Error al eliminar las mesas. Inténtalo de nuevo.');
    } finally {
      this.isDeletingTables.set(false);
    }
  }

  toggleShowEmailCurrentPassword() {
    this.showEmailCurrentPassword.update((val) => !val);
  }

  onSubmitEmailChange() {
    this.emailErrorMessage.set(null);
    this.emailSuccessMessage.set(null);

    const newEmail = this.newEmail().trim();
    const current = this.currentEmail() || '';

    if (!newEmail) {
      this.emailErrorMessage.set('Introduce un email o déjalo vacío para eliminarlo.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      this.emailErrorMessage.set('El formato del email no es válido.');
      return;
    }

    if (newEmail === current) {
      this.emailErrorMessage.set('El nuevo email es igual al actual.');
      return;
    }

    if (!this.emailCurrentPassword()) {
      this.emailErrorMessage.set('Introduce tu contraseña actual para confirmar el cambio.');
      return;
    }

    this.isSubmittingEmail.set(true);

    this.authService
      .updateMyEmail({ email: newEmail, currentPassword: this.emailCurrentPassword() })
      .subscribe({
        next: (res) => {
          this.isSubmittingEmail.set(false);
          this.emailSuccessMessage.set(
            res.message || 'Email actualizado correctamente.',
          );
          // Actualizamos el email mostrado.
          this.currentEmail.set(res.data?.email ?? null);
          this.newEmail.set('');
          this.emailCurrentPassword.set('');
        },
        error: (err) => {
          this.isSubmittingEmail.set(false);
          const msg =
            err?.error?.message ||
            'No se pudo actualizar el email. Inténtalo de nuevo más tarde.';
          this.emailErrorMessage.set(msg);
        },
      });
  }

  // --- Password Recovery / Reset with Email Code ---
  onRequestResetCode() {
    this.isRequestingResetCode.set(true);
    this.resetErrorMessage.set(null);
    this.resetSuccessMessage.set(null);

    this.authService.requestPasswordResetCode().subscribe({
      next: (res) => {
        this.isRequestingResetCode.set(false);
        this.codeRequested.set(true);
        this.resetSuccessMessage.set(
          res.message || 'Código de verificación enviado a tu correo electrónico.',
        );
        if (res.code) {
          this.resetCode.set(res.code);
        }
      },
      error: (err) => {
        this.isRequestingResetCode.set(false);
        const msg =
          err?.error?.message ||
          'No se pudo enviar el código. Verifica que tu cuenta tenga un email registrado.';
        this.resetErrorMessage.set(msg);
      },
    });
  }

  toggleShowNewPassword() {
    this.showNewPassword.update((val) => !val);
  }

  onConfirmResetPassword() {
    const code = this.resetCode().trim();
    const newPass = this.newPassword();
    const confirmPass = this.confirmPassword();

    this.resetErrorMessage.set(null);
    this.resetSuccessMessage.set(null);

    if (!code) {
      this.resetErrorMessage.set('Introduce el código de 6 dígitos recibido por correo.');
      return;
    }

    if (!newPass || newPass.length < 8) {
      this.resetErrorMessage.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPass !== confirmPass) {
      this.resetErrorMessage.set('Las contraseñas no coinciden. Verifícalas e inténtalo de nuevo.');
      return;
    }

    this.isSubmittingReset.set(true);

    this.authService.resetPasswordWithCode(code, newPass).subscribe({
      next: (res) => {
        this.isSubmittingReset.set(false);
        this.resetSuccessMessage.set(
          res.message || '¡Contraseña restablecida con éxito!',
        );
        this.resetCode.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.codeRequested.set(false);
      },
      error: (err) => {
        this.isSubmittingReset.set(false);
        const msg =
          err?.error?.message ||
          'Error al restablecer la contraseña. Comprueba el código e inténtalo de nuevo.';
        this.resetErrorMessage.set(msg);
      },
    });
  }
}
