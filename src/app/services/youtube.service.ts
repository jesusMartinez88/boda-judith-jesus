import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

export interface YouTubeVideoResult {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle?: string;
}

@Injectable({
  providedIn: 'root',
})
export class YouTubeService {
  private http = inject(HttpClient);
  private readonly YOUTUBE_API_KEY = (window as any).NG_APP_YOUTUBE_API_KEY || process.env['NG_APP_YOUTUBE_API_KEY'] || null;
  private readonly API_URL = 'https://www.googleapis.com/youtube/v3/search';

  buscarVideos(termino: string): Observable<YouTubeVideoResult[]> {
    if (!this.YOUTUBE_API_KEY) {
      console.error('YouTube API key not configured');
      return of([]);
    }

    const params = {
      part: 'snippet',
      maxResults: '5',
      type: 'video',
      q: termino,
      key: this.YOUTUBE_API_KEY,
    };

    return this.http.get<any>(this.API_URL, { params }).pipe(
      map((response) => {
        if (!response?.items) {
          return [];
        }

        return response.items.map((item: any) => {
          const videoId = item.id?.videoId || item.id;
          const title = item.snippet?.title || '';
          const thumbnail = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '';
          const channelTitle = item.snippet?.channelTitle || '';

          return {
            id: videoId,
            title: title,
            thumbnail: thumbnail,
            channelTitle: channelTitle,
          };
        });
      }),
      catchError((error) => {
        console.error('Error searching YouTube videos:', error);
        throw error;
      })
    );
  }
}
