import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, MusicPlaylistSong } from '../../types/api';

export interface MusicSong {
  id?: number;
  title: string;
  artist: string;
  youtubeUrl: string;
  youtubeId?: string;
  note?: string;
  addedAt?: string;
  order?: number;
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
      const response = await firstValueFrom(
        this.http.get<ApiResponse<MusicPlaylistSong[]>>(this.apiUrl),
      );
      const apiItems = response.data || [];

      const itemsWithIds = apiItems.map((song) => this.normalizeSong(song));
      itemsWithIds.sort((a, b) => (a.order || 0) - (b.order || 0));

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
        youtubeId: this.extractYoutubeId(song.youtubeUrl),
      };

      const currentSongs = this.songs();
      songToCreate.order =
        currentSongs.length > 0 ? Math.max(...currentSongs.map((s) => s.order || 0)) + 1 : 0;

      const response = await firstValueFrom(
        this.http.post<ApiResponse<MusicPlaylistSong>>(
          this.apiUrl,
          songToCreate as unknown as MusicPlaylistSong,
        ),
      );
      const result = this.normalizeSong((response.data ?? songToCreate) as MusicSong);

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
      const currentSong = current.find((s) => s.id === id);
      const optimisticSong: MusicSong = currentSong
        ? { ...currentSong, ...songUpdate }
        : { ...(songUpdate as MusicSong) };

      const response = await firstValueFrom(
        this.http.patch<ApiResponse<MusicPlaylistSong>>(
          `${this.apiUrl}/${id}`,
          songUpdate as unknown as MusicPlaylistSong,
        ),
      );
      const result = this.normalizeSong((response.data ?? optimisticSong) as MusicSong);

      const updatedSongs = this.songs().map((s) => (s.id === id ? result : s));
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
      order: index,
    }));

    const previousSongs = this.songs();
    this.songs.set(orderedSongs);

    try {
      const response = await firstValueFrom(
        this.http.put<ApiResponse<MusicPlaylistSong[]>>(`${this.apiUrl}/reorder`, {
          songs: orderedSongs.map((s) => ({ id: Number(s.id), order: Number(s.order) })),
        }),
      );
      const resultSongs = (response.data || []).map((song) => this.normalizeSong(song));
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
      await firstValueFrom(
        this.http.delete<ApiResponse<{ deletedId?: number }>>(`${this.apiUrl}/${id}`),
      );

      const filteredSongs = this.songs().filter((s) => s.id !== id);
      this.songs.set(filteredSongs);
    } catch (error) {
      console.error('Error deleting song:', error);
      throw error;
    }
  }

  private extractYoutubeId(url: string): string | undefined {
    if (!url) return undefined;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : undefined;
  }

  private normalizeSong(song: MusicPlaylistSong | MusicSong | Record<string, unknown>): MusicSong {
    const raw: Record<string, unknown> = song as Record<string, unknown>;

    const youtubeUrl = (raw['youtubeUrl'] as string) || (raw['youtube_url'] as string) || '';
    const youtubeId =
      (raw['youtubeId'] as string) ||
      (raw['youtube_id'] as string) ||
      this.extractYoutubeId(youtubeUrl);

    const idVal = raw['id'] ?? raw['_id'];
    const id = idVal !== undefined ? (idVal as number) : undefined;

    return {
      id: id !== undefined ? id : undefined,
      title: (raw['title'] as string) || '',
      artist: (raw['artist'] as string) || '',
      youtubeUrl,
      youtubeId,
      note: (raw['note'] as string) || undefined,
      addedAt: (raw['addedAt'] as string) || (raw['added_at'] as string) || undefined,
      order: (raw['order'] as number) || (raw['order_index'] as number) || undefined,
    };
  }
}
