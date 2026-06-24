import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';

import { AssignSeatModalComponent } from './assign-seat-modal';

describe('AssignSeatModalComponent', () => {
  let component: AssignSeatModalComponent;
  let fixture: ComponentFixture<AssignSeatModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignSeatModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignSeatModalComponent);
    component = fixture.componentInstance;
    
    // Initialize required inputs
    component.assignSearchControl = new FormControl<string>('', { nonNullable: true });
    component.panelTable = { id: 1, name: 'Mesa 1' };
    component.assignableGuests = [];
    component.selectedTableFreeSeats = [];

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
