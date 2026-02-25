import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
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

    // CAPTCHA properties
    captchaQuestion = signal('');
    private correctCaptchaAnswer: number = 0;

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

            this.authService.login({
                username: formValue.username!,
                password: formValue.password!
            }).subscribe({
                next: () => {
                    this.router.navigate(['/dashboard']);
                },
                error: (err) => {
                    this.isLoading.set(false);
                    this.errorMessage.set('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
                    this.generateCaptcha(); // Regenerate on failure
                }
            });
        }
    }
}
