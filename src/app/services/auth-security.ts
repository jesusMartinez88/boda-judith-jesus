import { environment } from '../../environments/environment';

export function isFirstPartyApiUrl(url: string): boolean {
  try {
    const apiOrigin = new URL(environment.apiBaseUrl).origin;
    const request = new URL(url, apiOrigin);
    return request.origin === apiOrigin && request.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}
