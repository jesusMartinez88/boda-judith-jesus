import { Component, inject, signal, effect } from '@angular/core';
import { form, FormField, submit, required, minLength } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PwaService } from '../../services/pwa.service';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormField, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private pwaService = inject(PwaService);

  // Model signal - never use null/undefined as initial values
  protected readonly loginModel = signal({
    username: '',
    password: '',
    captcha: '',
  });

  // Signal Forms
  protected readonly loginForm = form(this.loginModel, (s) => {
    required(s.username, { message: 'El usuario es obligatorio' });
    minLength(s.username, 4, { message: 'Mínimo 4 caracteres' });
    required(s.password, { message: 'La contraseña es obligatoria' });
    minLength(s.password, 4, { message: 'Mínimo 4 caracteres' });
    required(s.captcha, { message: 'Resuelve el CAPTCHA' });
  });

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  loadingMessage = signal<string>('');

  // CAPTCHA properties
  captchaQuestion = signal('');
  private correctCaptchaAnswer = 0;

  private intervalId?: ReturnType<typeof setInterval>;
  private loadingStartTime = 0;

  constructor() {
    this.generateCaptcha();

    // effect() corre fuera de zona — no necesita NgZone ni ChangeDetectorRef
    effect(() => {
      if (this.isLoading()) {
        this.loadingStartTime = Date.now();
        this.intervalId = setInterval(() => {
          const elapsed = Date.now() - this.loadingStartTime;
          if (elapsed >= 45000) {
            this.loadingMessage.set('Ya casi estamos, gracias por esperar...');
          } else if (elapsed >= 30000) {
            this.loadingMessage.set('El servidor está despertando, solo un momento más...');
          } else if (elapsed >= 15000) {
            this.loadingMessage.set('Gracias por tu paciencia, casi listo...');
          } else if (elapsed >= 5000) {
            this.loadingMessage.set('El servidor se está iniciando, esto puede tardar un minuto...');
          }
        }, 1000);
      } else {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
        this.loadingMessage.set('');
      }
    }, { allowSignalWrites: true });
  }

  generateCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    this.correctCaptchaAnswer = num1 + num2;
    this.captchaQuestion.set(`${num1} + ${num2}`);

    // Reset captcha field in form model
    this.loginModel.update((m) => ({ ...m, captcha: '' }));
  }

  onSubmit() {
    submit(this.loginForm, async () => {
      const formValue = this.loginModel();
      const userAnswer = parseInt(formValue.captcha || '', 10);

      if (userAnswer !== this.correctCaptchaAnswer) {
        this.errorMessage.set('CAPTCHA incorrecto. Por favor, intenta de nuevo.');
        this.generateCaptcha();
        return;
      }

      this.isLoading.set(true);
      this.errorMessage.set(null);

      try {
        await new Promise<void>((resolve, reject) => {
          this.authService
            .login({
              username: formValue.username,
              password: formValue.password,
            })
            .subscribe({
              next: () => resolve(),
              error: () => reject(),
            });
        });

        // Notificar al servicio PWA que el usuario se ha logueado
        this.pwaService.onUserLoggedIn();
        // Usar replaceUrl para que la página de login no quede en el historial
        // y al pulsar "atrás" no vuelva al login
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      } catch {
        this.errorMessage.set('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
        this.generateCaptcha();
      } finally {
        this.isLoading.set(false);
      }
    });
  }
}
