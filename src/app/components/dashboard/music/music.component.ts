import { Component, OnInit, OnDestroy, inject, signal, computed, effect, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { MusicPlaylistService, MusicSong } from '../../../services/music-playlist.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

declare const YT: any;
@Component({
  selector: 'app-music',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DragDropModule],
  templateUrl: './music.component.html',
  styleUrl: './music.component.css'
})
export class MusicComponent implements OnInit, OnDestroy, AfterViewInit {
  private musicService = inject(MusicPlaylistService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  @ViewChild('keepAliveAudio') keepAliveAudio!: ElementRef<HTMLAudioElement>;

  // Signals para el estado de la UI
  songs = this.musicService.songs;
  isLoading = this.musicService.isLoading;
  showModal = signal(false);
  isEditing = signal(false);
  isSubmitting = signal(false);
  currentPlayingId = signal<number | null | undefined>(null);
  songToDelete = signal<MusicSong | null>(null);

  // Estado del reproductor
  isVideoExpanded = signal(false);
  private player: any = null;
  private apiReady = false;

  // Búsqueda
  searchQuery = signal('');

  // Canción actual computada
  currentSong = computed(() => {
    const id = this.currentPlayingId();
    if (!id) return null;
    return this.songs().find(s => s.id === id) || null;
  });

  // Filtrado de canciones basado en la búsqueda
  filteredSongs = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.songs();

    return this.songs().filter(song =>
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      (song.note && song.note.toLowerCase().includes(query))
    );
  });

  // URL segura computada
  safeYoutubeUrl = computed(() => {
    const id = this.currentPlayingId();
    if (!id) return null;

    const song = this.songs().find(s => s.id === id);
    if (!song || !song.youtubeId) return null;

    const url = `https://www.youtube.com/embed/${song.youtubeId}?enablejsapi=1&autoplay=1&origin=${window.location.origin}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  hasPrevious = computed(() => {
    const id = this.currentPlayingId();
    if (!id) return false;
    const index = this.filteredSongs().findIndex(s => s.id === id);
    return index > 0;
  });

  hasNext = computed(() => {
    const id = this.currentPlayingId();
    if (!id) return false;
    const index = this.filteredSongs().findIndex(s => s.id === id);
    return index !== -1 && index < this.filteredSongs().length - 1;
  });

  musicForm: FormGroup;
  editingSongId: number | null = null;

  constructor() {
    this.musicForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      artist: ['', [Validators.required, Validators.minLength(2)]],
      youtubeUrl: ['', [Validators.required, Validators.pattern(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/)]],
      note: ['']
    });

    effect(() => {
      const id = this.currentPlayingId();
      const song = this.currentSong();

      if (id && this.player && this.player.loadVideoById) {
        if (song && song.youtubeId) {
          this.player.loadVideoById(song.youtubeId);
          this.updateMediaSession(song);
          this.startKeepAlive();
        }
      } else if (!id) {
        this.stopKeepAlive();
      }
    });
  }

  ngOnInit() {
    this.musicService.loadSongs();
    this.initYoutubeApi();
    this.setupMediaSessionHandlers();
  }

  ngAfterViewInit() {
    if (this.currentPlayingId()) {
      this.initPlayer();
    }
  }

  ngOnDestroy() {
    this.stopPlayback();
    if (this.player) {
      this.player.destroy();
    }
  }

  // --- Lógica de Keep-Alive (Android Background) ---
  private startKeepAlive() {
    if (this.keepAliveAudio && this.keepAliveAudio.nativeElement) {
      this.keepAliveAudio.nativeElement.play().catch(err => {
        console.warn('Keep-alive audio failed to play (user interaction might be needed):', err);
      });
    }
  }

  private stopKeepAlive() {
    if (this.keepAliveAudio && this.keepAliveAudio.nativeElement) {
      this.keepAliveAudio.nativeElement.pause();
    }
  }

  // --- Media Session API (Controles en Pantalla de Bloqueo) ---
  private setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        const song = this.currentSong();
        if (song) this.playSong(song);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.stopPlayback();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.previousSong();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.nextSong();
      });
    }
  }

  private updateMediaSession(song: MusicSong) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: 'Boda Judith & Jesús',
        artwork: [
          { src: `https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  initYoutubeApi() {
    if ((window as any).YT && (window as any).YT.Player) {
      this.apiReady = true;
      return;
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      this.apiReady = true;
      if (this.currentPlayingId()) {
        this.initPlayer();
      }
    };

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }

  initPlayer() {
    if (!this.apiReady) return;

    setTimeout(() => {
      const iframe = document.getElementById('youtube-player-iframe');
      if (!iframe) return;

      this.player = new YT.Player('youtube-player-iframe', {
        events: {
          'onStateChange': (event: any) => {
            if (event.data === 0) { // ENDED
              this.nextSong();
            } else if (event.data === 1) { // PLAYING
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
              this.startKeepAlive();
            } else if (event.data === 2) { // PAUSED
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            }
          },
          'onError': (error: any) => {
            console.error('Error en el reproductor de YouTube:', error);
            setTimeout(() => this.nextSong(), 2000);
          }
        }
      });
    }, 500);
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  openAddModal() {
    this.isEditing.set(false);
    this.editingSongId = null;
    this.musicForm.reset();
    this.showModal.set(true);
  }

  editSong(song: MusicSong) {
    this.isEditing.set(true);
    this.editingSongId = song.id || null;
    this.musicForm.patchValue({
      title: song.title,
      artist: song.artist,
      youtubeUrl: song.youtubeUrl,
      note: song.note
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.musicForm.reset();
    this.isSubmitting.set(false);
  }

  async onSubmit() {
    if (this.musicForm.invalid) {
      this.musicForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const songData: MusicSong = this.musicForm.value;

    try {
      if (this.isEditing() && this.editingSongId) {
        await this.musicService.updateSong(this.editingSongId, songData);
      } else {
        await this.musicService.addSong(songData);
      }
      this.closeModal();
    } catch (error) {
      console.error('Error saving song:', error);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  confirmDelete(song: MusicSong) {
    this.songToDelete.set(song);
  }

  async deleteSong() {
    const song = this.songToDelete();
    if (!song || !song.id) return;

    try {
      await this.musicService.removeSong(song.id);
      if (this.currentPlayingId() === song.id) {
        this.stopPlayback();
      }
      this.songToDelete.set(null);
    } catch (error) {
      console.error('Error deleting song:', error);
    }
  }

  playSong(song: MusicSong) {
    if (this.currentPlayingId() === song.id) {
      this.stopPlayback();
    } else {
      const isFirstPlay = !this.currentPlayingId();
      this.currentPlayingId.set(song.id);
      if (isFirstPlay) {
        this.initPlayer();
      }
      this.startKeepAlive();
    }
  }

  playAll() {
    if (this.filteredSongs().length > 0) {
      const firstSong = this.filteredSongs()[0];
      this.playSong(firstSong);
    }
  }

  nextSong() {
    const id = this.currentPlayingId();
    if (!id) return;
    const index = this.filteredSongs().findIndex(s => s.id === id);
    if (index !== -1 && index < this.filteredSongs().length - 1) {
      this.currentPlayingId.set(this.filteredSongs()[index + 1].id);
    } else {
      this.stopPlayback();
    }
  }

  previousSong() {
    const id = this.currentPlayingId();
    if (!id) return;
    const index = this.filteredSongs().findIndex(s => s.id === id);
    if (index > 0) {
      this.currentPlayingId.set(this.filteredSongs()[index - 1].id);
    }
  }

  stopPlayback() {
    this.currentPlayingId.set(null);
    this.isVideoExpanded.set(false);
    this.stopKeepAlive();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  toggleVideoExpand() {
    this.isVideoExpanded.update(v => !v);
  }

  // Funcionalidad Drag and Drop
  drop(event: CdkDragDrop<MusicSong[]>) {
    if (this.searchQuery().trim() !== '') return;

    const currentSongs = [...this.songs()];
    moveItemInArray(currentSongs, event.previousIndex, event.currentIndex);
    this.musicService.updateOrder(currentSongs);
  }
}
