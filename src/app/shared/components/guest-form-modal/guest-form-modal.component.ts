import { Component, EventEmitter, Input, Output, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Guest, GuestService } from '../../../services/guest.service';

@Component({
  selector: 'app-guest-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './guest-form-modal.component.html',
  styleUrl: './guest-form-modal.component.css'
})
export class GuestFormModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private guestService = inject(GuestService);

  @Input() guest: Guest | null = null;
  @Output() close = new EventEmitter<void>();

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
    needsTransport: [false]
  });

  ngOnInit() {
    if (this.guest) {
      this.isEditingGuest.set(true);
      this.editingGuestId.set(this.guest.id || null);
      this.guestForm.patchValue({
        name: this.guest.name || '',
        email: this.guest.email || '',
        phone: this.guest.phone || '',
        attendance: this.guest.attendance !== false && this.guest.attending !== 0,
        isAdult: (this.guest.isAdult ?? 1),
        mealType: this.guest.mealType || 'normal',
        allergies: this.guest.allergies || '',
        notes: this.guest.notes || '',
        needsTransport: !!this.guest.needsTransport
      });
    } else {
      this.isEditingGuest.set(false);
      this.editingGuestId.set(null);
    }
  }

  closeModal() {
    this.close.emit();
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
        attending: (formValue.attendance === false) ? 0 : 1,
        mealType: formValue.mealType || 'normal',
        allergies: formValue.allergies || '',
        notes: formValue.notes || '',
        needsTransport: !!formValue.needsTransport,
        isSavedInBbdd: false
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
