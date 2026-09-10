import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

type UsernameStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'server_error';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class RegisterComponent {
  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly processing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdSlug = signal<string | null>(null);

  protected readonly usernameStatus = signal<UsernameStatus>('idle');
  protected readonly usernameMessage = signal<string | null>(null);

  protected formData = {
    names: '',
    username: '',
    email: '',
    password: '',
  };

  private authService = inject(AuthService);
  private router = inject(Router);

  /**
   * Se llama al pulsar "Continuar al pago". Antes de avanzar al paso 2,
   * valida el username contra el backend. La respuesta del backend es
   * genérica (no distingue taken / reserved / invalid_format), así que
   * tampoco lo hacemos aquí: un único mensaje para "no disponible".
   */
  goToPayment() {
    this.errorMessage.set(null);
    this.usernameMessage.set(null);

    if (
      !this.formData.names ||
      !this.formData.username ||
      !this.formData.email ||
      !this.formData.password
    ) {
      this.errorMessage.set('Rellena todos los campos para continuar.');
      return;
    }
    if (this.formData.password.length < 8) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.formData.username.trim().length < 3) {
      this.errorMessage.set('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }

    this.usernameStatus.set('checking');
    this.usernameMessage.set('Comprobando disponibilidad…');

    this.authService
      .checkUsername(this.formData.username)
      .subscribe({
        next: (response) => {
          if (response?.available) {
            this.usernameStatus.set('available');
            this.usernameMessage.set('¡Nombre disponible!');
            this.step.set(2);
            return;
          }
          // El backend nunca debería devolver success:false sin haber
          // marcado un error real, pero por si acaso: tratamos cualquier
          // "no disponible" con un mensaje genérico.
          this.usernameStatus.set('unavailable');
          this.usernameMessage.set(
            'Este nombre de usuario no está disponible. Prueba con otro.',
          );
        },
        error: (err: HttpErrorResponse) => {
          console.error('[register] checkUsername error:', err);
          this.usernameStatus.set('server_error');
          this.usernameMessage.set(
            'No pudimos comprobar la disponibilidad. Inténtalo de nuevo.',
          );
        },
      });
  }

  simulatePayment() {
    if (this.processing()) {
      return;
    }

    this.processing.set(true);
    this.errorMessage.set(null);

    setTimeout(() => {
      this.authService
        .register({
          username: this.formData.username,
          email: this.formData.email,
          password: this.formData.password,
        })
        .subscribe({
          next: (response) => {
            this.createdSlug.set(response.user.slug);
            this.processing.set(false);
            this.step.set(3);
          },
          error: (err: HttpErrorResponse) => {
            this.processing.set(false);
            const backendMessage =
              (err.error && (err.error.message || err.error.error)) || '';
            this.errorMessage.set(
              backendMessage ||
                'No pudimos crear tu boda. Inténtalo de nuevo en unos segundos.',
            );
          },
        });
    }, 1000);
  }

  goToDashboard() {
    const slug = this.createdSlug() ?? this.formData.username;
    this.router.navigate([`/${slug}/dashboard`]);
  }

  goBackToForm() {
    this.errorMessage.set(null);
    // Limpiamos el feedback del username para que no aparezca "¡Nombre
    // disponible!" en cuanto el usuario vuelve al paso 1.
    this.usernameStatus.set('idle');
    this.usernameMessage.set(null);
    this.step.set(1);
  }
}
