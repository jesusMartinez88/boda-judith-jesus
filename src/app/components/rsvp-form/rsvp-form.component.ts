import { Component, signal, inject } from '@angular/core';

import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GuestService, Guest } from '../../services/guest.service';
import { ChromeAiService } from '../../services/chrome-ai.service';
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
  
  private chromeAi = inject(ChromeAiService);
  aiAvailable = this.chromeAi.isAvailable;
  aiLoading = this.chromeAi.isLoading;
  showDownloadModal = signal(false);
  showErrorModal = signal(false);
  aiErrorMessage = signal('');
  downloadProgress = signal(0);

  constructor(private formBuilder: FormBuilder, private guestService: GuestService) {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      //email: ['', [Validators.required, Validators.email]],
      email: [''],
      phone: ['', [Validators.pattern(/^[0-9]{9}$/)]],
      attendance: [true],
      adults: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
      children: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
      mealType: ['normal', Validators.required],
      needsTransport: [false, Validators.required],
      isSavedInBbdd: [false, Validators.required],
      allergies: [''],
      notes: ['']
    });

    // adjust validators when attendance toggles
    this.form.get('attendance')?.valueChanges.subscribe(att => {
      if (att) {
        this.applyAttendanceValidators();
      } else {
        this.clearAttendanceValidators();
      }
    });

    // initialize validators according to the starting value
    if (this.form.get('attendance')?.value) {
      this.applyAttendanceValidators();
    } else {
      this.clearAttendanceValidators();
    }
  }

  async onSubmit() {
    // if not attending we don't need to validate the other controls
    if (!this.form.get('attendance')?.value) {
      // mark the attendance control in case you want to show errors
      this.form.get('attendance')?.markAsTouched();
    } else if (this.form.invalid) {
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
      if (!guestData.attendance) {
        guestData.attending = 0;
      } else {
        guestData.attending = Number(guestData.adults || 0) + Number(guestData.children || 0);
      }
      await this.guestService.registerGuest(guestData);

      this.submitSuccess.set(true);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#be185d', '#ec4899', '#f472b6', '#ffffff']
      });

      this.form.reset({ adults: 1, children: 0, mealType: 'normal', needsTransport: false, isSavedInBbdd: false, attendance: guestData.attendance });
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

  private applyAttendanceValidators() {
    // required validators for when attending
    this.form.get('adults')?.setValidators([Validators.required, Validators.min(1), Validators.max(10)]);
    this.form.get('children')?.setValidators([Validators.required, Validators.min(0), Validators.max(10)]);
    this.form.get('mealType')?.setValidators(Validators.required);
    this.form.get('needsTransport')?.setValidators(Validators.required);
    this.form.get('isSavedInBbdd')?.setValidators(Validators.required);

    // update validity
    ['adults','children','mealType','needsTransport','isSavedInBbdd'].forEach(key => {
      this.form.get(key)?.updateValueAndValidity();
    });
  }

  private clearAttendanceValidators() {
    ['adults','children','mealType','needsTransport','isSavedInBbdd'].forEach(key => {
      this.form.get(key)?.clearValidators();
      this.form.get(key)?.updateValueAndValidity();
    });
  }

  async generateAiSuggestion() {
    if (!this.chromeAi.isAvailable()) {
      return;
    }
    
    // Verificar si necesita descarga antes de crear la sesión
    await this.chromeAi.recheckAvailability();
    
    if (this.chromeAi.needsDownload()) {
      this.showDownloadModal.set(true);
      return;
    }
    
    await this.performAiGeneration();
  }

  async generateAiExcuse() {
    if (!this.chromeAi.isAvailable()) {
      return;
    }
    
    // Verificar si necesita descarga antes de crear la sesión
    await this.chromeAi.recheckAvailability();
    
    if (this.chromeAi.needsDownload()) {
      this.showDownloadModal.set(true);
      return;
    }
    
    await this.performAiExcuseGeneration();
  }

  async confirmDownload() {
    this.showDownloadModal.set(false);
    // Marcar que ya no necesita descarga para evitar mostrar el modal de nuevo
    this.chromeAi.needsDownload.set(false);
    
    // Determinar qué acción ejecutar según el estado del formulario
    if (this.form.get('attendance')?.value) {
      await this.performAiGeneration();
    } else {
      await this.performAiExcuseGeneration();
    }
  }

  cancelDownload() {
    this.showDownloadModal.set(false);
  }

  private async performAiGeneration() {
    try {
      const { message, song } = await this.chromeAi.generateMessageAndSong();
      const currentNotes = this.form.get('notes')?.value || '';
      const newNotes = currentNotes 
        ? `${currentNotes}\n\n${message}\n🎵 ${song}`
        : `${message}\n🎵 ${song}`;
      
      this.form.patchValue({ notes: newNotes });
    } catch (error: any) {
      console.error('Error generando sugerencia:', error);
      this.aiErrorMessage.set(error.message || 'No se pudo generar la sugerencia. Por favor, intenta de nuevo.');
      this.showErrorModal.set(true);
    }
  }

  private async performAiExcuseGeneration() {
    try {
      const excuse = await this.chromeAi.generateExcuse();
      const currentNotes = this.form.get('notes')?.value || '';
      const newNotes = currentNotes 
        ? `${currentNotes}\n\n${excuse}`
        : excuse;
      
      this.form.patchValue({ notes: newNotes });
    } catch (error: any) {
      console.error('Error generando excusa:', error);
      this.aiErrorMessage.set(error.message || 'No se pudo generar el motivo. Por favor, intenta de nuevo.');
      this.showErrorModal.set(true);
    }
  }

  closeErrorModal() {
    this.showErrorModal.set(false);
  }
}
