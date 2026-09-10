import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  PLATFORM_ID,
  HostListener,
  ElementRef,
  viewChild,
  effect,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../services/admin.service';
import { AdminUser, AdminUserPatch } from '../../../types/api';
import { ExitConfirmService } from '../../services/exit-confirm.service';
import { ExitConfirmModalComponent } from '../../shared/components/exit-confirm-modal/exit-confirm-modal.component';

interface EditFormState {
  email: string;
  plan: 'free' | 'premium';
  paid: boolean;
  invitationCompleted: boolean;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ExitConfirmModalComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  private platformId = inject(PLATFORM_ID);
  protected exitConfirmService = inject(ExitConfirmService);

  // DOM refs para el focus trap del modal
  private firstFieldRef = viewChild<ElementRef<HTMLElement>>('firstField');
  private dialogRef = viewChild<ElementRef<HTMLElement>>('editDialog');

  users = signal<AdminUser[]>([]);
  isLoading = signal<boolean>(true);
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  searchQuery = signal<string>('');

  editingUser = signal<AdminUser | null>(null);
  editForm = signal<EditFormState>({
    email: '',
    plan: 'free',
    paid: false,
    invitationCompleted: false,
  });
  isSaving = signal<boolean>(false);

  confirmingDelete = signal<AdminUser | null>(null);
  isDeleting = signal<boolean>(false);

  filteredUsers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.users();
    if (!query) return list;
    return list.filter((u) => {
      return (
        u.username.toLowerCase().includes(query) ||
        (u.email ?? '').toLowerCase().includes(query) ||
        u.slug.toLowerCase().includes(query)
      );
    });
  });

  totalCount = computed(() => this.users().length);
  paidCount = computed(() => this.users().filter((u) => u.paid).length);
  invitationCount = computed(
    () => this.users().filter((u) => u.hasInvitation).length,
  );

  constructor() {
    // Foco inicial al abrir el modal (solo navegador; en SSR no hay DOM).
    effect(() => {
      if (this.editingUser() && isPlatformBrowser(this.platformId)) {
        // Esperar al siguiente tick para que el modal ya esté pintado.
        queueMicrotask(() => {
          this.firstFieldRef()?.nativeElement?.focus();
        });
      }
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.adminService
      .listUsers()
      .then((users) => {
        this.users.set(users);
        this.isLoading.set(false);
      })
      .catch((err: HttpErrorResponse) => {
        console.error('[admin] list users error:', err);
        this.loadError.set(
          this.extractMessage(err, 'No se pudieron cargar los usuarios.'),
        );
        this.isLoading.set(false);
      });
  }

  onSearchChange(value: string) {
    this.searchQuery.set(value);
  }

  openEditDialog(user: AdminUser) {
    if (user.isProtected) return;
    this.actionError.set(null);
    this.editingUser.set(user);
    this.editForm.set({
      email: user.email ?? '',
      plan: (user.plan === 'premium' ? 'premium' : 'free') as 'free' | 'premium',
      paid: user.paid,
      invitationCompleted: !!user.invitationCompletedAt,
    });
  }

  closeEditDialog() {
    if (this.isSaving()) return;
    this.editingUser.set(null);
    this.actionError.set(null);
  }

  updateEditField<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
  ) {
    this.editForm.update((current) => ({ ...current, [key]: value }));
  }

  saveEdit() {
    const user = this.editingUser();
    if (!user) return;

    const form = this.editForm();
    const patch: AdminUserPatch = {
      email: form.email.trim() ? form.email.trim() : null,
      plan: form.plan,
      paidAt: form.paid ? new Date().toISOString() : null,
      invitationCompletedAt: form.invitationCompleted
        ? new Date().toISOString()
        : null,
    };

    this.isSaving.set(true);
    this.actionError.set(null);
    this.adminService
      .updateUser(user.id, patch)
      .then((updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
        );
        this.isSaving.set(false);
        this.editingUser.set(null);
      })
      .catch((err: HttpErrorResponse) => {
        console.error('[admin] update user error:', err);
        this.actionError.set(this.extractMessage(err, 'No se pudo guardar.'));
        this.isSaving.set(false);
      });
  }

  openDeleteConfirm(user: AdminUser) {
    if (user.isProtected) return;
    this.actionError.set(null);
    this.confirmingDelete.set(user);
  }

  closeDeleteConfirm() {
    if (this.isDeleting()) return;
    this.confirmingDelete.set(null);
  }

  confirmDelete() {
    const user = this.confirmingDelete();
    if (!user) return;

    this.isDeleting.set(true);
    this.actionError.set(null);
    this.adminService
      .deleteUser(user.id)
      .then(() => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.isDeleting.set(false);
        this.confirmingDelete.set(null);
      })
      .catch((err: HttpErrorResponse) => {
        console.error('[admin] delete user error:', err);
        this.actionError.set(
          this.extractMessage(err, 'No se pudo eliminar el usuario.'),
        );
        this.isDeleting.set(false);
      });
  }

  /**
   * Trampa de foco simple: si el modal está abierto y Tab mueve el foco fuera,
   * lo devolvemos al primer campo. También cerramos con Escape.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (!isPlatformBrowser(this.platformId)) return;
    if (event.key === 'Escape') {
      if (this.editingUser()) {
        this.closeEditDialog();
      } else if (this.confirmingDelete()) {
        this.closeDeleteConfirm();
      }
      return;
    }
    if (event.key !== 'Tab' || !this.editingUser()) return;

    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;

    const focusables = dialog.querySelectorAll<HTMLElement>(
      'input, select, button, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Abre la invitación pública del usuario en una pestaña nueva.
   * El slug se toma del array `data[]` que devuelve el endpoint de admin,
   * y la ruta `:tenant` de Angular lo recoge en `paramMap` para que el
   * `RsvpFormComponent` pueda registrar invitados vía `/public/:slug`.
   */
  openInvitation(user: AdminUser) {
    if (!this.canOpenInvitation(user)) return;
    if (!isPlatformBrowser(this.platformId)) return;
    window.open(`/${user.slug}`, '_blank', 'noopener,noreferrer');
  }

  /**
   * Abre el modal de confirmación de salida (mismo patrón que el dashboard).
   * El `ExitConfirmModalComponent` se encarga de llamar a `AuthService.logout()`
   * si el usuario confirma.
   */
  logout() {
    this.exitConfirmService.openExitConfirm();
  }

  canOpenInvitation(user: AdminUser): boolean {
    return user.hasInvitation;
  }

  invitationButtonTitle(user: AdminUser): string {
    if (!user.hasInvitation) {
      return 'Este usuario aún no tiene invitación';
    }
    return 'Abrir invitación del usuario';
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string; error?: string } | null;
    return body?.message || body?.error || fallback;
  }
}
