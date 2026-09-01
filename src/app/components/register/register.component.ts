import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

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

  protected formData = {
    names: '',
    username: '',
    email: '',
    password: '',
  };

  private authService = inject(AuthService);
  private router = inject(Router);

  goToPayment() {
    this.errorMessage.set(null);

    if (!this.formData.names || !this.formData.username || !this.formData.email || !this.formData.password) {
      this.errorMessage.set('Rellena todos los campos para continuar.');
      return;
    }
    if (this.formData.password.length < 8) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    this.step.set(2);
  }

  simulatePayment() {
    if (this.processing()) {
      return;
    }

    this.processing.set(true);
    this.errorMessage.set(null);

    // Aquí iría la integración real (Stripe, Paypal).
    // Para la demo, simulamos 1 segundo de procesamiento y, tras el "pago",
    // registramos al usuario en el backend.
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
    this.step.set(1);
  }
}
