import { Component, OnInit, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaPromptComponent } from './components/pwa-prompt/pwa-prompt.component';
import { ExitConfirmModalComponent } from './shared/components/exit-confirm-modal/exit-confirm-modal.component';
import { ExitConfirmService } from './services/exit-confirm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PwaPromptComponent, ExitConfirmModalComponent],
  template: `
    <router-outlet />
    <app-pwa-prompt />
    @if (exitConfirmService.showExitConfirm()) {
      <app-exit-confirm-modal />
    }
  `,
})
export class App implements OnInit {
  exitConfirmService = inject(ExitConfirmService);

  ngOnInit() {
    // Push initial state to handle browser back button
    try {
      history.pushState({ dashboardGuard: true }, '', window.location.href);
    } catch {
      /* ignore */
    }
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(ev: PopStateEvent) {
    // Check if this is a back button press from our guarded route
    if (ev && (ev.state as { dashboardGuard?: boolean })?.dashboardGuard === true) {
      try {
        history.pushState({ dashboardGuard: true }, '', window.location.href);
      } catch {
        /* ignore */
      }
      this.exitConfirmService.openExitConfirm();
      return;
    }
  }
}
