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
        }, { allowSignalWrites: true });
    }

    private async attemptAutoplay(): Promise<void> {
        // Pequeño delay para asegurar que el audio esté cargado
        setTimeout(async () => {
            try {
                await this.audioService.play();
                console.log('🎵 Música iniciada automáticamente');
            } catch (error) {
                console.log('ℹ️ Reproducción automática bloqueada por el navegador. El usuario debe hacer clic en el botón.');
                // No mostramos error porque es comportamiento esperado en navegadores modernos
            }
        }, 500);
    }

    async toggleMusic(): Promise<void> {
        try {
            await this.audioService.toggle();
        } catch (error) {
            console.error('Error al reproducir música:', error);
            // Aquí podrías mostrar un toast o notificación al usuario
        }
    }
}
