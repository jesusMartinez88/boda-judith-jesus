import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type AiGenerateType = 'absence_reason' | 'attendance_note' | 'song_request' | 'attendance_full';

export interface AiGenerateRequest {
  type: AiGenerateType;
  guestName: string;
  songHint?: string;
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
      this.http.post<AiGenerateResponse>(this.url, payload)
    );
    return response.data.text;
  }
}
