import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvitationFooterComponent } from '../../shared/components/invitation-footer/invitation-footer.component';

@Component({
  selector: 'app-invitation-not-found',
  imports: [RouterLink, InvitationFooterComponent],
  templateUrl: './invitation-not-found.component.html',
  styleUrl: './invitation-not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvitationNotFoundComponent {}
