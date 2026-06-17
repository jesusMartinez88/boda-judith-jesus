import { Component, input, output } from '@angular/core';

export type InfoPopupType = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-info-popup',
  templateUrl: './info-popup.component.html',
  styleUrl: './info-popup.component.css',
})
export class InfoPopupComponent {
  title = input.required<string>();
  message = input.required<string>();
  type = input<InfoPopupType>('info');
  actionLabel = input('Entendido');

  closed = output<void>();

  close() {
    this.closed.emit();
  }
}
