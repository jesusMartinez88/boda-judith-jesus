import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignSeatModal } from './assign-seat-modal';

describe('AssignSeatModal', () => {
  let component: AssignSeatModal;
  let fixture: ComponentFixture<AssignSeatModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignSeatModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignSeatModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
