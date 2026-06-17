import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { GuestService } from '../../services/guest.service';
import { TableService } from '../../services/table.service';

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

  /** Value shared across the app */
  maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);
  totalEstimatedGuests = computed(
    () => this.settingsService.settings().total_estimated_guests || 0,
  );
  autoAssignTables = computed(() => this.settingsService.settings().auto_assign_tables ?? false);

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

  ngOnInit() {
    this.settingsService.loadSettings().subscribe();
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
}
