import { Component } from '@angular/core';
import { HeroComponent } from './components/hero/hero.component';
import { CountdownComponent } from './components/countdown/countdown.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { MapComponent } from './components/map/map.component';
import { RsvpFormComponent } from './components/rsvp-form/rsvp-form.component';
import { MusicPlayerComponent } from './components/music-player/music-player.component';

@Component({
  selector: 'app-root',
  imports: [
    HeroComponent,
    CountdownComponent,
    GalleryComponent,
    TimelineComponent,
    MapComponent,
    RsvpFormComponent,
    MusicPlayerComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App { }
