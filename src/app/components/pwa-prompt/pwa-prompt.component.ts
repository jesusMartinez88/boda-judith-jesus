import { Component, inject } from '@angular/core';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-prompt',
  standalone: true,
  templateUrl: './pwa-prompt.component.html',
  styleUrl: './pwa-prompt.component.css'
})
export class PwaPromptComponent {
  pwaService = inject(PwaService);

  installApp() {
    this.pwaService.installApp();
  }

  dismissInstall() {
    this.pwaService.dismissInstallPrompt();
  }

  reloadApp() {
    this.pwaService.reloadApp();
  }

  dismissUpdate() {
    this.pwaService.dismissUpdatePrompt();
  }
}
