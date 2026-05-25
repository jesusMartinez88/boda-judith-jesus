import { Injectable } from '@angular/core';
import packageJson from '../../../package.json';

@Injectable({
  providedIn: 'root',
})
export class VersionService {
  private readonly version = packageJson.version;

  getVersion(): string {
    return this.version;
  }

  getFullVersion(): string {
    return `v${this.version}`;
  }
}
