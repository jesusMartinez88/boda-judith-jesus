import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  inject,
} from '@angular/core';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
})
export class ToastComponent implements OnChanges {
  private cdr = inject(ChangeDetectorRef);

  @Input() show = false;
  @Input() type: 'success' | 'error' = 'success';
  @Input() title = '';
  @Input() message = '';
  @Input() duration = 3500;
  @Output() closed = new EventEmitter<void>();

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && this.show) {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        this.handleClose();
        this.cdr.markForCheck();
      }, this.duration);
    }
  }

  handleClose() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.closed.emit();
  }
}
