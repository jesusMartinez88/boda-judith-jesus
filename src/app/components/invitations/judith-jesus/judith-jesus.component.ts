import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import AOS from 'aos';
import { HeroComponent } from '../../hero/hero.component';
import { GalleryComponent } from '../../gallery/gallery.component';
import { TimelineComponent } from '../../timeline/timeline.component';
import { MapComponent } from '../../map/map.component';
import { RsvpFormComponent } from '../../rsvp-form/rsvp-form.component';
import { MusicPlayerComponent } from '../../music-player/music-player.component';
import { GiftsComponent } from '../../gifts/gifts.component';
import { ContactComponent } from '../../contact/contact.component';
import { CalendarComponent } from '../../calendar/calendar.component';
import { InvitationFooterComponent } from '../../../shared/components/invitation-footer/invitation-footer.component';
import { InvitationMediaService } from '../../../services/invitation-media.service';

@Component({
  selector: 'app-judith-jesus-invitation',
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
    InvitationFooterComponent,
  ],
  templateUrl: './judith-jesus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JudithJesusComponent implements OnInit {
  private readonly mediaService = inject(InvitationMediaService);
  readonly coverUrl = signal<string | null>(null);
  readonly galleryUrls = signal<string[]>([]);

  async ngOnInit() {
    AOS.init({
      duration: 1000,
      once: true,
      easing: 'ease-out-cubic',
    });
    try {
      const media = await firstValueFrom(this.mediaService.listPublic('judith-jesus'));
      this.coverUrl.set(media.coverUrl);
      this.galleryUrls.set(media.galleryUrls);
    } catch {
      // La invitación mantiene sus imágenes de muestra si no hay fotos personalizadas.
    }
  }
}
