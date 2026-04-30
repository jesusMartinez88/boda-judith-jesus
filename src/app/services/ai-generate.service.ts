import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AiGenerateType = 'absence_reason' | 'attendance_note' | 'song_request' | 'attendance_full' | 'invitation_text';

export interface AiGenerateRequest {
  type: AiGenerateType;
  guestName: string;
  songHint?: string;
  stream?: boolean;
}

export interface AiGenerateResponse {
  success: boolean;
  data: {
    type: string;
    guestName: string;
    text: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AiGenerateService {
  private readonly url = `${environment.apiBaseUrl}/api/ai/generate`;
  private http = inject(HttpClient);

  async generate(payload: AiGenerateRequest): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<AiGenerateResponse>(this.url, { ...payload, stream: false })
    );
    return response.data.text;
  }

  generateStream(payload: AiGenerateRequest): Observable<string> {
    return new Observable<string>((observer) => {
      const controller = new AbortController();
      
      fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal
      }).then(async (response) => {
        if (!response.ok) {
          observer.error(new Error(`HTTP error! status: ${response.status}`));
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          observer.error(new Error('No reader available'));
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            observer.next(chunk);
          }
          observer.complete();
        } catch (e) {
          observer.error(e);
        } finally {
          reader.releaseLock();
        }
      }).catch(err => {
        observer.error(err);
      });

      return () => controller.abort();
    });
  }
}
