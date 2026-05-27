import { Component, OnInit, OnDestroy, inject, signal, computed, effect, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MusicPlaylistService, MusicSong } from '../../../services/music-playlist.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { fromEvent, Subject, timer } from 'rxjs';
import { takeUntil, filter, switchMap } from 'rxjs/operators';

declare var YT: any;

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
  private destroy$ = new Subject<void>();

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

    // Manejo reactivo de cambios de canción
    effect(() => {
      const song = this.currentSong();
      if (song && this.player && this.player.loadVideoById) {
        this.player.loadVideoById(song.youtubeId);
        this.updateMediaSession(song);
        this.startKeepAlive();
      } else if (!song) {
        this.stopKeepAlive();
      }
    });
  }

  ngOnInit() {
    this.musicService.loadSongs();
    this.initYoutubeApi();
    this.setupMediaSessionHandlers();
    this.setupReactiveVisibility();
  }

  ngAfterViewInit() {
    if (this.currentPlayingId()) {
      this.initPlayer();
    }
  }

  ngOnDestroy() {
    this.stopPlayback();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.player) {
      this.player.destroy();
    }
  }

  // --- Lógica Reactiva de Visibilidad ---
  private setupReactiveVisibility() {
    fromEvent(document, 'visibilitychange')
      .pipe(
        takeUntil(this.destroy$),
        filter(() => document.visibilityState === 'hidden' && !!this.currentPlayingId()),
        switchMap(() => timer(200)) 
      )
      .subscribe(() => {
        this.startKeepAlive();
        if (this.player && this.player.getPlayerState() === 2) {
          this.player.playVideo();
        }
      });
  }

  // --- Lógica de Keep-Alive ---
  private startKeepAlive() {
    if (this.keepAliveAudio?.nativeElement) {
      this.keepAliveAudio.nativeElement.volume = 0.01;
      this.keepAliveAudio.nativeElement.play().catch(() => {});
    }
  }

  private stopKeepAlive() {
    if (this.keepAliveAudio?.nativeElement) {
      this.keepAliveAudio.nativeElement.pause();
      this.keepAliveAudio.nativeElement.currentTime = 0;
    }
  }

  // --- Media Session API ---
  private setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
      const actions: [MediaSessionAction, () => void][] = [
        ['play', () => { this.player?.playVideo(); this.startKeepAlive(); }],
        ['pause', () => { this.player?.pauseVideo(); this.stopKeepAlive(); }],
        ['previoustrack', () => this.previousSong()],
        ['nexttrack', () => this.nextSong()],
        ['stop', () => this.stopPlayback()]
      ];

      actions.forEach(([action, handler]) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
          console.warn(`Action ${action} not supported`);
        }
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
          { src: `https://img.youtube.com/vi/${song.youtubeId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          { src: `https://img.youtube.com/vi/${song.youtubeId}/maxresdefault.jpg`, sizes: '1280x720', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.playbackState = 'playing';
    }
  }

  initYoutubeApi() {
    if ((window as any).YT?.Player) {
      this.apiReady = true;
      return;
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      this.apiReady = true;
      if (this.currentPlayingId()) this.initPlayer();
    };

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }

  initPlayer() {
    if (!this.apiReady) return;

    timer(500).pipe(takeUntil(this.destroy$)).subscribe(() => {
      const iframe = document.getElementById('youtube-player-iframe');
      if (!iframe) return;

      this.player = new YT.Player('youtube-player-iframe', {
        events: {
          'onStateChange': (event: any) => {
            const state = event.data;
            if (state === 0) { // ENDED
              this.nextSong();
            } else if (state === 1) { // PLAYING
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
              this.startKeepAlive();
            } else if (state === 2) { // PAUSED
              if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
              if (document.visibilityState === 'hidden') {
                timer(300).pipe(takeUntil(this.destroy$)).subscribe(() => {
                  if (this.player?.getPlayerState() === 2) this.player.playVideo();
                });
              }
            }
          },
          'onError': () => timer(2000).pipe(takeUntil(this.destroy$)).subscribe(() => this.nextSong())
        }
      });
    });
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
    if (!song?.id) return;

    try {
      await this.musicService.removeSong(song.id);
      if (this.currentPlayingId() === song.id) this.stopPlayback();
      this.songToDelete.set(null);
    } catch (error) {
      console.error('Error deleting song:', error);
    }
  }

  playSong(song: MusicSong) {
    if (this.currentPlayingId() === song.id) {
      if (this.player) {
        const state = this.player.getPlayerState();
        state === 1 ? this.player.pauseVideo() : this.player.playVideo();
      }
    } else {
      const isFirstPlay = !this.currentPlayingId();
      this.currentPlayingId.set(song.id);
      if (isFirstPlay) this.initPlayer();
      this.startKeepAlive();
    }
  }

  playAll() {
    if (this.filteredSongs().length > 0) {
      this.playSong(this.filteredSongs()[0]);
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
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  toggleVideoExpand() {
    this.isVideoExpanded.update(v => !v);
  }

  drop(event: CdkDragDrop<MusicSong[]>) {
    if (this.searchQuery().trim() !== '') return;
    const currentSongs = [...this.songs()];
    moveItemInArray(currentSongs, event.previousIndex, event.currentIndex);
    this.musicService.updateOrder(currentSongs);
  }
}
