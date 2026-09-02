import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  selector: 'app-invitation',
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
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.css',
})
export class InvitationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  tenant = signal<string>('');

  ngOnInit() {
    this.tenant.set(this.route.snapshot.paramMap.get('tenant') || '');
    
    AOS.init({
      duration: 1000,
      once: true,
      easing: 'ease-out-cubic',
    });
  }
}
