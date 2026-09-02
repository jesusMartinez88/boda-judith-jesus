import { describe, expect, it } from 'vitest';
import { isFirstPartyApiUrl } from './auth-security';

describe('authentication security policy', () => {
  it('allows tokens only for the configured first-party API', () => {
    expect(isFirstPartyApiUrl('http://localhost:3000/api/guests')).toBe(true);
    expect(isFirstPartyApiUrl('/api/auth/login')).toBe(true);
  });

  it('rejects third-party, non-API, and malformed URLs', () => {
    expect(isFirstPartyApiUrl('https://attacker.example/api/collect')).toBe(false);
    expect(isFirstPartyApiUrl('https://www.googleapis.com/youtube/v3/videos')).toBe(false);
    expect(isFirstPartyApiUrl('http://localhost:3000/dashboard')).toBe(false);
    expect(isFirstPartyApiUrl('not a url')).toBe(false);
  });
});
