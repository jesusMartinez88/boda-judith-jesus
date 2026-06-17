import { Component, inject, signal, OnInit, input, output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Guest, GuestService } from '../../../services/guest.service';

@Component({
  selector: 'app-guest-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './guest-form-modal.component.html',
  styleUrl: './guest-form-modal.component.css',
})
export class GuestFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private guestService = inject(GuestService);

  readonly guest = input<Guest | null>(null);
  readonly modalClose = output<void>();

  isLoading = signal(false);
  isEditingGuest = signal(false);
  editingGuestId = signal<string | null>(null);

  guestForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.email]],
    phone: [''],
    attendance: [true],
    isAdult: [1, [Validators.required]],
    mealType: ['normal', [Validators.required]],
    allergies: [''],
    notes: [''],
    needsTransport: [false],
  });

  ngOnInit() {
    const guest = this.guest();
    if (guest) {
      this.isEditingGuest.set(true);
      this.editingGuestId.set(guest.id || null);
      this.guestForm.patchValue({
        name: guest.name || '',
        email: guest.email || '',
        phone: guest.phone || '',
        attendance: guest.attendance !== false && guest.attending !== 0,
        isAdult: guest.isAdult ?? 1,
        mealType: guest.mealType || 'normal',
        allergies: guest.allergies || '',
        notes: guest.notes || '',
        needsTransport: !!guest.needsTransport,
      });
    } else {
      this.isEditingGuest.set(false);
      this.editingGuestId.set(null);
    }
  }

  closeModal() {
    this.modalClose.emit();
  }

  async saveGuest() {
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    try {
      this.isLoading.set(true);

      const formValue: Guest = this.guestForm.value;
      const isAdult = Number(formValue.isAdult) === 1;
      const guestData: Guest = {
        name: (formValue.name || '').trim(),
        email: (formValue.email || '').trim(),
        phone: (formValue.phone || '').trim(),
        attendance: formValue.attendance !== false,
        isAdult: isAdult ? 1 : 0,
        adults: isAdult ? 1 : 0,
        children: isAdult ? 0 : 1,
        attending: formValue.attendance === false ? 0 : 1,
        mealType: formValue.mealType || 'normal',
        allergies: formValue.allergies || '',
        notes: formValue.notes || '',
        needsTransport: !!formValue.needsTransport,
        isSavedInBbdd: false,
      };

      if (this.isEditingGuest() && this.editingGuestId()) {
        await this.guestService.updateGuest(this.editingGuestId()!, guestData);
      } else {
        guestData.sendEmail = false;
        await this.guestService.registerGuest(guestData);
      }

      this.closeModal();
    } catch (error) {
      console.error('Error saving guest:', error);
      alert('Hubo un problema al guardar los datos. Por favor, inténtalo de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
