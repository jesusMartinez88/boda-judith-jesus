import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ExitConfirmService } from '../../../services/exit-confirm.service';

@Component({
  selector: 'app-exit-confirm-modal',
  standalone: true,
  template: `
    <button
      type="button"
      class="modal-backdrop"
      (click)="cancelExit()"
      (keydown.enter)="cancelExit()"
      aria-label="Cerrar modal"
      tabindex="0"
    ></button>
    <div
      class="modal-container confirm-exit-modal"
      role="dialog"
      aria-modal="true"
      tabindex="0"
      (click)="$event.stopPropagation()"
      (keydown.enter)="$event.stopPropagation()"
    >
      <div class="modal-header">
        <h3>¿Deseas salir de la aplicación?</h3>
        <button class="close-btn" (click)="cancelExit()">×</button>
      </div>
      <div class="modal-body">
        <p>Si sales volverás a la pantalla de acceso. ¿Estás seguro?</p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary-modal" (click)="cancelExit()">No</button>
        <button class="btn-danger" (click)="confirmExit()">Sí, salir</button>
      </div>
    </div>
  `,
  styles: `
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.25s ease-out;
      border: none;
      cursor: default;
    }

    .modal-container.confirm-exit-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10001;
      background: white;
      width: 92%;
      max-width: 430px;
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      max-height: 80vh;
    }

    .modal-header {
      padding: 1.4rem 2rem;
      background: linear-gradient(135deg, #fff7ed 0%, #fff 100%);
      border-bottom: 1px solid #fed7aa;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-header h3 {
      margin: 0;
      font-family: 'Playfair Display', serif;
      color: #1e293b;
      font-size: 1.2rem;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .modal-header h3::before {
      content: '⚠️';
      font-size: 1rem;
      line-height: 1;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.8rem;
      color: #94a3b8;
      cursor: pointer;
      line-height: 1;
      transition: color 0.2s;
    }

    .close-btn:hover {
      color: #475569;
    }

    .modal-body {
      padding: 1.8rem 2rem 1rem;
      overflow-y: auto;
    }

    .modal-body p {
      margin: 0;
      color: #475569;
      line-height: 1.55;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.7rem;
      padding: 0 2rem 1.6rem;
    }

    .btn-secondary-modal {
      background: #f1f5f9;
      color: #475569;
      border: none;
      padding: 0.7rem 1.2rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-secondary-modal:hover {
      background: #e2e8f0;
      color: #334155;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      border: none;
      padding: 0.7rem 1.2rem;
      border-radius: 12px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-danger:hover {
      background: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(239, 68, 68, 0.25);
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translate(-50%, calc(-50% + 20px)) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExitConfirmModalComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  exitConfirmService = inject(ExitConfirmService);

  confirmExit() {
    this.exitConfirmService.closeExitConfirm();
    this.authService.logout();
  }

  cancelExit() {
    this.exitConfirmService.closeExitConfirm();
  }
}
