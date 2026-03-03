import { Component, signal } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GuestService, Guest } from '../../services/guest.service';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-rsvp-form',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './rsvp-form.component.html',
  styleUrl: './rsvp-form.component.css'
})
export class RsvpFormComponent {
  form: FormGroup;
  isSubmitting = signal(false);
  submitSuccess = signal(false);
  submitError = signal(false);
  errorMessage = signal('');

  constructor(private formBuilder: FormBuilder, private guestService: GuestService) {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      //email: ['', [Validators.required, Validators.email]],
      email: [''],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
      adults: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
      children: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
      mealType: ['normal', Validators.required],
      needsTransport: [false, Validators.required],
      isSavedInBbdd: [false, Validators.required],
      allergies: [''],
      notes: ['']
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(false);
    this.submitSuccess.set(false);

    try {
      let guestData: Guest = { ...this.form.value };
      guestData.attending = Number(guestData.adults || 0) + Number(guestData.children || 0);
      await this.guestService.registerGuest(guestData);

      this.submitSuccess.set(true);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#be185d', '#ec4899', '#f472b6', '#ffffff']
      });

      this.form.reset({ adults: 1, children: 0, mealType: 'normal', needsTransport: false, isSavedInBbdd: false });

      // Esperar 2 segundos usando requestAnimationFrame para máxima eficiencia
      const startTime = performance.now();
      const checkDelay = (now: number) => {
        if (now - startTime >= 3000) {
          this.submitSuccess.set(false);
          const contactSection = document.getElementById('contact');
          if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          requestAnimationFrame(checkDelay);
        }
      };
      requestAnimationFrame(checkDelay);

    } catch (error: any) {
      this.submitError.set(true);
      this.errorMessage.set(
        error.response?.data?.message || 'Error al registrar asistencia. Intenta de nuevo.'
      );
      setTimeout(() => this.submitError.set(false), 5000);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}
