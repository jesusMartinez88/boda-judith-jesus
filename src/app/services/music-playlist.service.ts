import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface MusicSong {
  id?: number;
  title: string;
  artist: string;
  youtubeUrl: string;
  youtubeId?: string;
  note?: string;
  addedAt?: string;
  order?: number; // Campo para mantener el orden
}

@Injectable({
  providedIn: 'root',
})
export class MusicPlaylistService {
  private apiUrl = `${environment.apiBaseUrl}/api/music-playlist`;
  private http = inject(HttpClient);

  songs = signal<MusicSong[]>([]);
  isLoading = signal<boolean>(false);

  // Variable para evitar múltiples intentos fallidos seguidos al backend
  private apiAvailable = true;

  async loadSongs(): Promise<MusicSong[]> {
    this.isLoading.set(true);
    try {
      let finalItems: MusicSong[] = [];

      if (this.apiAvailable) {
        try {
          const response = await firstValueFrom(
            this.http.get<MusicSong[] | { data: MusicSong[] }>(this.apiUrl).pipe(
              catchError(err => {
                if (err.status === 404 || err.status === 0) this.apiAvailable = false;
                throw err;
              })
            )
          );
          const list = response && 'data' in response ? response.data : response;
          finalItems = Array.isArray(list) ? list : [];
        } catch {
          const local = localStorage.getItem('wedding_music_playlist');
          finalItems = local ? JSON.parse(local) : [];
        }
      } else {
        const local = localStorage.getItem('wedding_music_playlist');
        finalItems = local ? JSON.parse(local) : [];
      }

      // Ordenar por el campo 'order'
      finalItems.sort((a, b) => (a.order || 0) - (b.order || 0));

      const itemsWithIds = finalItems.map(song => ({
        ...song,
        youtubeId: song.youtubeId || this.extractYoutubeId(song.youtubeUrl)
      }));

      this.songs.set(itemsWithIds);
      this.saveToLocal(itemsWithIds);
      return itemsWithIds;
    } catch (error) {
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async addSong(song: MusicSong): Promise<MusicSong> {
    try {
      song.youtubeId = this.extractYoutubeId(song.youtubeUrl);
      const currentSongs = this.songs();
      song.order = currentSongs.length > 0 ? Math.max(...currentSongs.map(s => s.order || 0)) + 1 : 0;

      let result: MusicSong;
      if (this.apiAvailable) {
        try {
          result = await firstValueFrom(this.http.post<MusicSong>(this.apiUrl, song));
        } catch (apiError) {
          result = {
            ...song,
            id: Date.now(),
            addedAt: new Date().toISOString()
          };
        }
      } else {
        result = {
          ...song,
          id: Date.now(),
          addedAt: new Date().toISOString()
        };
      }

      const updatedSongs = [...this.songs(), result];
      this.songs.set(updatedSongs);
      this.saveToLocal(updatedSongs);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async updateSong(id: number, songUpdate: Partial<MusicSong>): Promise<MusicSong> {
    try {
      if (songUpdate.youtubeUrl) {
        songUpdate.youtubeId = this.extractYoutubeId(songUpdate.youtubeUrl);
      }

      let result: MusicSong;
      if (this.apiAvailable) {
        try {
          result = await firstValueFrom(this.http.patch<MusicSong>(`${this.apiUrl}/${id}`, songUpdate));
        } catch (apiError) {
          const current = this.songs();
          const index = current.findIndex(s => s.id === id);
          result = index !== -1 ? { ...current[index], ...songUpdate } : { ...songUpdate as MusicSong };
        }
      } else {
        const current = this.songs();
        const index = current.findIndex(s => s.id === id);
        result = index !== -1 ? { ...current[index], ...songUpdate } : { ...songUpdate as MusicSong };
      }

      const updatedSongs = this.songs().map(s => s.id === id ? result : s);
      this.songs.set(updatedSongs);
      this.saveToLocal(updatedSongs);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async updateOrder(songs: MusicSong[]): Promise<void> {
    const orderedSongs = songs.map((song, index) => ({
      ...song,
      order: index
    }));

    this.songs.set(orderedSongs);
    this.saveToLocal(orderedSongs);

    if (this.apiAvailable) {
      try {
        await firstValueFrom(this.http.put(`${this.apiUrl}/reorder`, { songs: orderedSongs }));
      } catch (apiError) {
        // Silenciamos el error si no hay backend
      }
    }
  }

  async removeSong(id: number): Promise<void> {
    try {
      if (this.apiAvailable) {
        try {
          await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
        } catch (apiError) {
          // Error de API silenciado
        }
      }

      const filteredSongs = this.songs().filter(s => s.id !== id);
      this.songs.set(filteredSongs);
      this.saveToLocal(filteredSongs);
    } catch (error) {
      throw error;
    }
  }

  private extractYoutubeId(url: string): string | undefined {
    if (!url) return undefined;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : undefined;
  }

  private saveToLocal(songs: MusicSong[]) {
    try {
      localStorage.setItem('wedding_music_playlist', JSON.stringify(songs));
    } catch (e) {
      // Error local silenciado
    }
  }
}
