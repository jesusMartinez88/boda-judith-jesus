import { Component, inject, effect } from '@angular/core';

import { AudioService } from '../../services/audio.service';

@Component({
    selector: 'app-music-player',
    imports: [],
    templateUrl: './music-player.component.html',
    styleUrl: './music-player.component.css'
})
export class MusicPlayerComponent {
    private readonly audioService = inject(AudioService);

    // Exponer signals del servicio para el template
    readonly isPlaying = this.audioService.isPlaying;
    readonly isLoaded = this.audioService.isLoaded;

    constructor() {
        // Usar effect para configurar la música cuando el componente se inicializa
        effect(() => {
            // Configurar la ruta de la música de fondo
            // El archivo está en public/music/ que Angular sirve desde la raíz
            this.audioService.setSource('music/background-music.mp3');

            // Intentar reproducir automáticamente
            // Nota: Los navegadores pueden bloquear esto si el usuario no ha interactuado
            this.attemptAutoplay();

            // Agregar listeners para interacciones del usuario
            this.addInteractionListeners();
        }, { allowSignalWrites: true });
    }

    private async attemptAutoplay(): Promise<void> {
        // Pequeño delay para asegurar que el audio esté cargado
        setTimeout(async () => {
            try {
                if (!this.isPlaying()) {
                    await this.audioService.play();
                    console.log('🎵 Música iniciada automáticamente');
                    this.removeInteractionListeners();
                }
            } catch (error) {
                console.log('ℹ️ Esperando interacción del usuario para iniciar música...');
            }
        }, 500);
    }

    private addInteractionListeners(): void {
        const startAudio = () => this.handleUserInteraction();

        window.addEventListener('scroll', startAudio, { once: true });
        window.addEventListener('mousemove', startAudio, { once: true });
        window.addEventListener('touchstart', startAudio, { once: true });
        window.addEventListener('click', startAudio, { once: true });
    }

    private async handleUserInteraction(): Promise<void> {
        if (!this.isPlaying()) {
            try {
                await this.audioService.play();
                console.log('🎵 Música iniciada tras interacción del usuario');
                this.removeInteractionListeners();
            } catch (error) {
                // Silencioso si falla
            }
        }
    }

    private removeInteractionListeners(): void {
        const startAudio = () => this.handleUserInteraction();
        window.removeEventListener('scroll', startAudio);
        window.removeEventListener('mousemove', startAudio);
        window.removeEventListener('touchstart', startAudio);
        window.removeEventListener('click', startAudio);
    }

    async toggleMusic(): Promise<void> {
        try {
            await this.audioService.toggle();
        } catch (error) {
            console.error('Error al reproducir música:', error);
        }
    }
}
