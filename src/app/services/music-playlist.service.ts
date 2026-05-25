import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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

  async loadSongs(): Promise<MusicSong[]> {
    this.isLoading.set(true);
    try {
      let finalItems: MusicSong[] = [];
      
      try {
        const response = await firstValueFrom(this.http.get<MusicSong[] | { data: MusicSong[] }>(this.apiUrl));
        const list = response && 'data' in response ? response.data : response;
        finalItems = Array.isArray(list) ? list : [];
      } catch (apiError) {
        console.warn('API error, falling back to localStorage:', apiError);
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
      console.error('Error in loadSongs:', error);
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async addSong(song: MusicSong): Promise<MusicSong> {
    try {
      song.youtubeId = this.extractYoutubeId(song.youtubeUrl);
      // Asignar el último orden
      const currentSongs = this.songs();
      song.order = currentSongs.length > 0 ? Math.max(...currentSongs.map(s => s.order || 0)) + 1 : 0;
      
      let result: MusicSong;
      try {
        result = await firstValueFrom(this.http.post<MusicSong>(this.apiUrl, song));
      } catch (apiError) {
        console.warn('API error on add, saving locally:', apiError);
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
      console.error('Error adding song:', error);
      throw error;
    }
  }

  async updateSong(id: number, songUpdate: Partial<MusicSong>): Promise<MusicSong> {
    try {
      if (songUpdate.youtubeUrl) {
        songUpdate.youtubeId = this.extractYoutubeId(songUpdate.youtubeUrl);
      }
      
      let result: MusicSong;
      try {
        result = await firstValueFrom(this.http.patch<MusicSong>(`${this.apiUrl}/${id}`, songUpdate));
      } catch (apiError) {
        console.warn('API error on update, updating locally:', apiError);
        const current = this.songs();
        const index = current.findIndex(s => s.id === id);
        if (index !== -1) {
          result = { ...current[index], ...songUpdate };
        } else {
          throw new Error('Song not found');
        }
      }

      const updatedSongs = this.songs().map(s => s.id === id ? result : s);
      this.songs.set(updatedSongs);
      this.saveToLocal(updatedSongs);
      return result;
    } catch (error) {
      console.error('Error updating song:', error);
      throw error;
    }
  }

  async updateOrder(songs: MusicSong[]): Promise<void> {
    // Actualizar los índices de orden
    const orderedSongs = songs.map((song, index) => ({
      ...song,
      order: index
    }));

    this.songs.set(orderedSongs);
    this.saveToLocal(orderedSongs);

    try {
      // Intentar persistir en el backend si existe endpoint de bulk update o similar
      await firstValueFrom(this.http.put(`${this.apiUrl}/reorder`, { songs: orderedSongs }));
    } catch (apiError) {
      console.warn('API error on reorder, saved locally:', apiError);
    }
  }

  async removeSong(id: number): Promise<void> {
    try {
      try {
        await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
      } catch (apiError) {
        console.warn('API error on delete, removing locally:', apiError);
      }
      
      const filteredSongs = this.songs().filter(s => s.id !== id);
      this.songs.set(filteredSongs);
      this.saveToLocal(filteredSongs);
    } catch (error) {
      console.error('Error removing song:', error);
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
      console.error('Error saving to localStorage:', e);
    }
  }
}
