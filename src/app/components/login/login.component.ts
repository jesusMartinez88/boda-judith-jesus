import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ReactiveFormsModule, RouterLink],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    loginForm = this.fb.group({
        username: ['', [Validators.required, Validators.minLength(4)]],
        password: ['', [Validators.required, Validators.minLength(4)]],
        captcha: ['', [Validators.required]]
    });

    isLoading = signal(false);
    errorMessage = signal<string | null>(null);
    loadingMessage = signal<string>('');

    // CAPTCHA properties
    captchaQuestion = signal('');
    private correctCaptchaAnswer: number = 0;
    
    private messageTimers: ReturnType<typeof setTimeout>[] = [];

    constructor() {
        this.generateCaptcha();
    }

    generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        this.correctCaptchaAnswer = num1 + num2;
        this.captchaQuestion.set(`${num1} + ${num2}`);

        // Reset captcha field in form
        this.loginForm.patchValue({ captcha: '' });
    }

    onSubmit() {
        if (this.loginForm.valid) {
            const formValue = this.loginForm.getRawValue();
            const userAnswer = parseInt(formValue.captcha || '', 10);

            if (userAnswer !== this.correctCaptchaAnswer) {
                this.errorMessage.set('CAPTCHA incorrecto. Por favor, intenta de nuevo.');
                this.generateCaptcha();
                return;
            }

            this.isLoading.set(true);
            this.errorMessage.set(null);
            this.startLoadingMessages();

            this.authService.login({
                username: formValue.username!,
                password: formValue.password!
            }).subscribe({
                next: () => {
                    this.clearLoadingMessages();
                    this.router.navigate(['/dashboard']);
                },
                error: (err) => {
                    this.clearLoadingMessages();
                    this.isLoading.set(false);
                    this.errorMessage.set('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
                    this.generateCaptcha(); // Regenerate on failure
                }
            });
        }
    }

    private startLoadingMessages() {
        // Primer mensaje después de 5 segundos
        const timer1 = setTimeout(() => {
            this.loadingMessage.set('El servidor se está iniciando, esto puede tardar un minuto...');
        }, 5000);

        // Mensaje después de 15 segundos
        const timer2 = setTimeout(() => {
            this.loadingMessage.set('Gracias por tu paciencia, casi listo...');
        }, 15000);

        // Mensaje después de 30 segundos
        const timer3 = setTimeout(() => {
            this.loadingMessage.set('El servidor está despertando, solo un momento más...');
        }, 30000);

        // Mensaje después de 45 segundos
        const timer4 = setTimeout(() => {
            this.loadingMessage.set('Ya casi estamos, gracias por esperar...');
        }, 45000);

        this.messageTimers = [timer1, timer2, timer3, timer4];
    }

    private clearLoadingMessages() {
        this.messageTimers.forEach(timer => clearTimeout(timer));
        this.messageTimers = [];
        this.loadingMessage.set('');
    }
}
