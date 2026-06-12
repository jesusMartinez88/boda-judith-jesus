import { Component, input, output } from '@angular/core';
import { Guest } from '../../../services/guest.service';

@Component({
  selector: 'app-guest-delete-modal',
  standalone: true,
  styleUrl: './guest-delete-modal.component.css',
  template: `
    <div
      class="modal-backdrop"
      (click)="cancel.emit()"
      (keydown.enter)="cancel.emit()"
      tabindex="0"
      role="button"
      aria-label="Cerrar confirmación de eliminación de invitado"
    >
      <div
        class="modal-container delete-confirm"
        (click)="$event.stopPropagation()"
        (keydown.enter)="$event.stopPropagation()"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div class="modal-header">
          <h3>Eliminar Invitado</h3>
          <button class="close-btn" (click)="cancel.emit()">×</button>
        </div>
        <div class="modal-body warning-theme">
          <div class="warning-visual">
            <span class="confirm-icon">👤❌</span>
          </div>
          <p>¿Seguro que quieres eliminar a {{ guest()?.name }}?</p>
          <p class="secondary-text">
            Esta acción no se puede deshacer y el invitado será borrado permanentemente.
          </p>

          <div class="modal-actions full-width-btns">
            <button class="btn-danger" (click)="confirm.emit()">
              Sí, eliminar invitado
            </button>
            <button class="btn-secondary-modal" (click)="cancel.emit()">
              No, mantener invitado
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GuestDeleteModalComponent {
  guest = input<Guest | null>(null);
  confirm = output<void>();
  cancel = output<void>();
}
