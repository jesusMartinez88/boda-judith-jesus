import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaPromptComponent } from './components/pwa-prompt/pwa-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PwaPromptComponent],
  template: `
    <router-outlet></router-outlet>
    <app-pwa-prompt></app-pwa-prompt>
  `
})
export class App { }
