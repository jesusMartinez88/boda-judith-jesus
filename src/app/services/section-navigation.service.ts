import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Navegación a secciones de la landing con comportamiento consistente
 * desde cualquier página pública (`/`, `/contacto`, …).
 *
 * Si la URL actual ya es la landing (`/`), hace scroll suave al elemento.
 * Si estamos en otra ruta, navega a `/` con el fragment y, tras el
 * siguiente render, hace scroll al destino.
 *
 * Diseñado para ser el único punto de verdad del patrón "ir a una
 * sección desde el header o desde el footer", evitando duplicar la
 * lógica en cada componente.
 */
@Injectable({ providedIn: 'root' })
export class SectionNavigationService {
  private readonly router = inject(Router);

  /**
   * Contador de requests en vuelo. Si llega una nueva llamada mientras
   * hay otra pendiente (ej. el usuario hace click rápido en dos anclas),
   * la vieja se aborta para no actualizar referencias internas sobre
   * vistas ya destruidas — eso provocaba
   * `Cannot read properties of undefined (reading 'startTime')` en
   * `reportAllChanges`.
   */
  private currentRequestId = 0;

  /**
   * Manejador genérico para `<a (click)="…">`. Evita la navegación por
   * defecto y aplica la lógica de scroll inteligente.
   *
   * Si JS está deshabilitado, el `href` del enlace cae en la navegación
   * nativa del navegador y la URL queda como `/<ruta>#section`, que el
   * propio navegador sabe scrollear.
   */
  async goToSection(event: Event, sectionId: string): Promise<void> {
    event.preventDefault();

    const myRequestId = ++this.currentRequestId;

    const isHome =
      this.router.url === '/' ||
      this.router.url === '' ||
      this.router.url.startsWith('/#');

    if (isHome) {
      this.scrollToElement(sectionId);
      this.updateHash(sectionId);
      return;
    }

    try {
      await this.router.navigate(['/'], { fragment: sectionId });
    } catch {
      // El navigate puede fallar si el usuario navega antes de que
      // termine; abortamos silenciosamente.
      return;
    }

    // Si mientras esperábamos el navigate llegó otra llamada, abortamos.
    if (myRequestId !== this.currentRequestId) return;

    // Doble rAF: da tiempo a que el componente de la landing se monte y
    // pinte el DOM antes de buscar el destino.
    requestAnimationFrame(() => {
      if (myRequestId !== this.currentRequestId) return;
      requestAnimationFrame(() => {
        if (myRequestId !== this.currentRequestId) return;
        this.scrollToElement(sectionId);
        this.updateHash(sectionId);
      });
    });
  }

  private scrollToElement(sectionId: string): void {
    if (typeof document === 'undefined') return;
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private updateHash(sectionId: string): void {
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `#${sectionId}`);
  }
}
