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
  private readonly YOUTUBE_API_KEY =
    ((window as unknown as Record<string, unknown>)['NG_APP_YOUTUBE_API_KEY'] as
      | string
      | undefined) ||
    process.env['NG_APP_YOUTUBE_API_KEY'] ||
    null;
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

    return this.http.get<{ items?: Record<string, unknown>[] }>(this.API_URL, { params }).pipe(
      map((response) => {
        const items = response?.items ?? [];

        return items.map((item) => {
          const it = item as Record<string, unknown>;
          const idField = it['id'];
          let videoId: string;
          if (idField && typeof idField === 'object') {
            const idObj = idField as Record<string, unknown>;
            videoId = String(idObj['videoId'] ?? idObj['video_id'] ?? '');
          } else {
            videoId = String(idField ?? '');
          }

          const snippet = it['snippet'] as Record<string, unknown> | undefined;
          const title =
            snippet && typeof snippet['title'] !== 'undefined' ? String(snippet['title']) : '';
          const thumbnails =
            snippet && (snippet['thumbnails'] as Record<string, unknown> | undefined);
          const thumbnail =
            thumbnails &&
            ((thumbnails['medium'] as Record<string, unknown>)?.['url'] ??
              (thumbnails['default'] as Record<string, unknown>)?.['url'])
              ? String(
                  (thumbnails['medium'] as Record<string, unknown>)?.['url'] ??
                    (thumbnails['default'] as Record<string, unknown>)?.['url'],
                )
              : '';
          const channelTitle =
            snippet && typeof snippet['channelTitle'] !== 'undefined'
              ? String(snippet['channelTitle'])
              : '';

          return {
            id: String(videoId || ''),
            title,
            thumbnail,
            channelTitle,
          } as YouTubeVideoResult;
        });
      }),
      catchError((error) => {
        console.error('Error searching YouTube videos:', error);
        throw error;
      }),
    );
  }
}
