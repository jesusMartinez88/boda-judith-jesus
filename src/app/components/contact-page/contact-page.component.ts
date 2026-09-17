import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LandingContactComponent } from '../landing-contact/landing-contact.component';
import { LandingFooterComponent } from '../landing-footer/landing-footer.component';
import { LandingHeaderComponent } from '../landing-header/landing-header.component';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [LandingHeaderComponent, LandingContactComponent, LandingFooterComponent],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPageComponent {}
