import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GuestService, Guest } from '../../services/guest.service';

@Component({
  selector: 'app-rsvp-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
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
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9\s\-\+\(\)]+$/)]],
      attending: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
      mealType: ['normal', Validators.required],
      needsTransport: [false],
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
      const guestData: Guest = this.form.value;
      await this.guestService.registerGuest(guestData);
      this.submitSuccess.set(true);
      this.form.reset({ attending: 1, mealType: 'normal', needsTransport: false });
      setTimeout(() => this.submitSuccess.set(false), 5000);
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
