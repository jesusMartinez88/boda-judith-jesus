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
      const response = await firstValueFrom(this.http.get<MusicSong[] | { data: MusicSong[] }>(this.apiUrl));
      const finalItems = this.unwrapListResponse(response);

      finalItems.sort((a, b) => (a.order || 0) - (b.order || 0));

      const itemsWithIds = finalItems.map((song) => this.normalizeSong(song));

      this.songs.set(itemsWithIds);
      return itemsWithIds;
    } catch (error) {
      console.error('Error loading music playlist:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async addSong(song: MusicSong): Promise<MusicSong> {
    try {
      const songToCreate: MusicSong = {
        ...song,
        youtubeId: this.extractYoutubeId(song.youtubeUrl)
      };

      const currentSongs = this.songs();
      songToCreate.order = currentSongs.length > 0 ? Math.max(...currentSongs.map(s => s.order || 0)) + 1 : 0;

      const response = await firstValueFrom(this.http.post<MusicSong | { data: MusicSong }>(this.apiUrl, songToCreate));
      const result = this.normalizeSong(this.unwrapItemResponse(response, songToCreate));

      const updatedSongs = [...this.songs(), result];
      this.songs.set(updatedSongs);
      return result;
    } catch (error) {
      console.error('Error creating song:', error);
      throw error;
    }
  }

  async updateSong(id: number, songUpdate: Partial<MusicSong>): Promise<MusicSong> {
    try {
      if (songUpdate.youtubeUrl) {
        songUpdate.youtubeId = this.extractYoutubeId(songUpdate.youtubeUrl);
      }

      const current = this.songs();
      const currentSong = current.find(s => s.id === id);
      const optimisticSong: MusicSong = currentSong ? { ...currentSong, ...songUpdate } : { ...songUpdate as MusicSong };

      const response = await firstValueFrom(this.http.patch<MusicSong | { data: MusicSong }>(`${this.apiUrl}/${id}`, songUpdate));
      const result = this.normalizeSong(this.unwrapItemResponse(response, optimisticSong));

      const updatedSongs = this.songs().map(s => s.id === id ? result : s);
      this.songs.set(updatedSongs);
      return result;
    } catch (error) {
      console.error('Error updating song:', error);
      throw error;
    }
  }

  async updateOrder(songs: MusicSong[]): Promise<void> {
    const orderedSongs = songs.map((song, index) => ({
      ...song,
      order: index
    }));

    const previousSongs = this.songs();
    this.songs.set(orderedSongs);

    try {
      const response = await firstValueFrom(
        this.http.put<MusicSong[] | { data: MusicSong[] }>(`${this.apiUrl}/reorder`, { songs: orderedSongs })
      );
      const resultSongs = this.unwrapListResponse(response).map((song) => this.normalizeSong(song));
      if (resultSongs.length > 0) {
        this.songs.set(resultSongs);
      }
    } catch (error) {
      this.songs.set(previousSongs);
      console.error('Error reordering songs:', error);
      throw error;
    }
  }

  async removeSong(id: number): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));

      const filteredSongs = this.songs().filter(s => s.id !== id);
      this.songs.set(filteredSongs);
    } catch (error) {
      console.error('Error deleting song:', error);
      throw error;
    }
  }

  private extractYoutubeId(url: string): string | undefined {
    if (!url) return undefined;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : undefined;
  }

  private unwrapListResponse(response: MusicSong[] | { data: MusicSong[] }): MusicSong[] {
    if (Array.isArray(response)) {
      return response;
    }

    if (response && typeof response === 'object' && Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  }

  private unwrapItemResponse(response: MusicSong | { data: MusicSong }, fallback: MusicSong): MusicSong {
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }

    if (response && typeof response === 'object') {
      return response as MusicSong;
    }

    return fallback;
  }

  private normalizeSong(song: MusicSong): MusicSong {
    const rawSong = song as MusicSong & {
      youtube_url?: string;
      youtube_id?: string;
      added_at?: string;
      order_index?: number;
    };

    const youtubeUrl = rawSong.youtubeUrl || rawSong.youtube_url || '';
    const youtubeId = rawSong.youtubeId || rawSong.youtube_id || this.extractYoutubeId(youtubeUrl);

    return {
      ...song,
      youtubeUrl,
      youtubeId,
      addedAt: song.addedAt || rawSong.added_at,
      order: song.order ?? rawSong.order_index,
    };
  }
}
