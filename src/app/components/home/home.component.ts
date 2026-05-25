import { Component, OnInit } from '@angular/core';
import AOS from 'aos';
import { HeroComponent } from '../hero/hero.component';
import { GalleryComponent } from '../gallery/gallery.component';
import { TimelineComponent } from '../timeline/timeline.component';
import { MapComponent } from '../map/map.component';
import { RsvpFormComponent } from '../rsvp-form/rsvp-form.component';
import { MusicPlayerComponent } from '../music-player/music-player.component';
import { GiftsComponent } from '../gifts/gifts.component';
import { ContactComponent } from '../contact/contact.component';
import { CalendarComponent } from '../calendar/calendar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeroComponent,
    GalleryComponent,
    TimelineComponent,
    MapComponent,
    RsvpFormComponent,
    MusicPlayerComponent,
    GiftsComponent,
    ContactComponent,
    CalendarComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  ngOnInit() {
    AOS.init({
      duration: 1000,
      once: true,
      easing: 'ease-out-cubic',
    });
  }
}
