import {
  Component,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectorRef,
  inject,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.css'],
})
export class ToastComponent implements OnChanges, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  readonly show = input(false);
  readonly type = input<'success' | 'error'>('success');
  readonly title = input('');
  readonly message = input('');
  readonly duration = input(3500);
  readonly closed = output<void>();

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && this.show()) {
      if (this.timeoutId) clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        this.handleClose();
        this.cdr.markForCheck();
      }, this.duration());
    }
  }

  handleClose() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.closed.emit();
  }

  ngOnDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
