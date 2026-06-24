import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Guest } from '../../../../services/guest.service';

@Component({
  selector: 'app-assign-seat-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './assign-seat-modal.html',
  styleUrl: './assign-seat-modal.css',
})
export class AssignSeatModalComponent {
  @Input({ required: true }) panelTable: any;
  @Input({ required: true }) assignableGuests: Guest[] = [];
  @Input({ required: true }) selectedTableFreeSeats: number[] = [];
  @Input({ required: true }) assignSearchControl!: FormControl<string>;
  @Input() selectedGuestToAssign: Guest | null = null;
  @Input() selectedSeatToAssign: number | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() selectGuest = new EventEmitter<Guest>();
  @Output() assignSeatChange = new EventEmitter<string>();
  @Output() confirmAssign = new EventEmitter<void>();

  guestKey(guest: Guest): string {
    return guest.id ?? guest.email ?? guest.phone ?? '';
  }

  isGuestSelectedForAssign(guest: Guest): boolean {
    if (!this.selectedGuestToAssign) return false;
    return this.guestKey(this.selectedGuestToAssign) === this.guestKey(guest);
  }
}
