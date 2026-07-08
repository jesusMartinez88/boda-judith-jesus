import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ExitConfirmService {
  showExitConfirm = signal(false);

  openExitConfirm() {
    this.showExitConfirm.set(true);
  }

  closeExitConfirm() {
    this.showExitConfirm.set(false);
  }
}
