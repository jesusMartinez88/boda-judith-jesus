import { Component, inject, signal, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-prompt',
  standalone: true,
  templateUrl: './pwa-prompt.component.html',
  styleUrl: './pwa-prompt.component.css',
})
export class PwaPromptComponent {
  pwaService = inject(PwaService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Signal para controlar si estamos en /dashboard
  isInDashboard = signal(false);

  constructor() {
    // Verificar ruta inicial
    this.checkRoute(this.router.url);

    // Escuchar cambios de ruta
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkRoute(event.url);
        this.cdr.markForCheck();
      });
  }

  private checkRoute(url: string) {
    this.isInDashboard.set(url.startsWith('/dashboard'));
  }

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
