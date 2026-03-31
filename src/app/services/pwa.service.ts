import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private deferredPrompt: any = null;
  showInstallPrompt = signal(false);
  showUpdatePrompt = signal(false);
  private isUserLoggedIn = false;

  constructor() {
    this.initPWA();
  }

  private initPWA() {
    // Detectar si la app ya está instalada
    if (this.isAppInstalled()) {
      console.log('App ya instalada');
      return;
    }

    // Capturar el evento beforeinstallprompt pero no mostrarlo aún
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('Prompt de instalación capturado, esperando login...');
    });

    // Registrar service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado:', registration);

          // Verificar actualizaciones cada hora
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);

          // Detectar cuando hay una nueva versión disponible
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nueva versión disponible
                  this.showUpdatePrompt.set(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Error al registrar Service Worker:', error);
        });
    }
  }

  private isAppInstalled(): boolean {
    // Detectar si está en modo standalone (instalada)
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  private isMobileOrSmallScreen(): boolean {
    // Detectar si es móvil o pantalla pequeña (< 1024px)
    return window.innerWidth < 1024;
  }

  // Método para llamar después del login exitoso
  onUserLoggedIn() {
    this.isUserLoggedIn = true;

    // Solo mostrar en móvil/pantallas pequeñas
    if (!this.isMobileOrSmallScreen()) {
      console.log('No es móvil, no se muestra prompt de instalación');
      return;
    }

    // Solo si tenemos el prompt capturado y no está instalada
    if (this.deferredPrompt && !this.isAppInstalled()) {
      // Verificar si ya fue rechazado recientemente (últimas 24 horas)
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        const dayInMs = 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < dayInMs) {
          console.log('Prompt rechazado recientemente, no se muestra');
          return;
        }
      }

      // Mostrar el prompt después de 3 segundos del login
      setTimeout(() => {
        this.showInstallPrompt.set(true);
      }, 3000);
    }
  }

  async installApp() {
    if (!this.deferredPrompt) {
      return;
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
    
    this.deferredPrompt = null;
    this.showInstallPrompt.set(false);
  }

  dismissInstallPrompt() {
    this.showInstallPrompt.set(false);
    // Guardar en localStorage para no volver a mostrar por 24 horas
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }

  reloadApp() {
    window.location.reload();
  }

  dismissUpdatePrompt() {
    this.showUpdatePrompt.set(false);
  }
}
