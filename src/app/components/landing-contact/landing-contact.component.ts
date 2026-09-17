import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ContactMessageCategory,
  ContactMessagePayload,
  ContactMessageService,
} from '../../services/contact-message.service';
import { environment } from '../../../environments/environment';

type SubmitStatus = 'idle' | 'sending' | 'success' | 'error';

interface CategoryOption {
  value: ContactMessageCategory;
  label: string;
  helper: string;
  emoji: string;
}

@Component({
  selector: 'app-landing-contact',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './landing-contact.component.html',
  styleUrl: './landing-contact.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Flag de "vivo". Se pone a `false` cuando el componente se destruye.
   * Si el usuario envía el formulario y navega antes de que la petición
   * HTTP termine, evitamos actualizar signals (y, por tanto, vistas de
   * Angular) sobre un componente muerto. Eso era la causa del
   * `Cannot read properties of undefined (reading 'startTime')` en
   * `reportAllChanges`.
   */
  private isAlive = true;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.isAlive = false;
    });
  }

  readonly categories: CategoryOption[] = [
    {
      value: 'info',
      label: 'Información del producto',
      helper: 'Quiero saber más sobre planes, precios o funcionalidades',
      emoji: '💍',
    },
    {
      value: 'soporte',
      label: 'Soporte técnico',
      helper: 'Tengo un problema con mi invitación o el panel',
      emoji: '🛠️',
    },
    {
      value: 'sugerencia',
      label: 'Sugerencia o feedback',
      helper: 'Una idea para mejorar la plataforma',
      emoji: '💡',
    },
    {
      value: 'otro',
      label: 'Otro',
      helper: 'Colaboraciones, prensa o lo que necesites',
      emoji: '✉️',
    },
  ];

  readonly submitStatus = signal<SubmitStatus>('idle');
  readonly errorMessage = signal<string>('');

  /** Datos del WhatsApp configurables desde `environment.ts`. */
  readonly whatsappNumber = environment.landingContact.whatsappNumber;
  readonly whatsappDisplay = environment.landingContact.whatsappDisplay;
  readonly whatsappUrl = (() => {
    const base = `https://wa.me/${environment.landingContact.whatsappNumber}`;
    const prefill = environment.landingContact.whatsappPrefill;
    return prefill ? `${base}?text=${encodeURIComponent(prefill)}` : base;
  })();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    category: ['info' as ContactMessageCategory, [Validators.required]],
    subject: ['', [Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
    website: [''], // honeypot
  });

  private markAllTouched(): void {
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
  }

  get f() {
    return this.form.controls;
  }

  get canSubmit(): boolean {
    return this.form.valid && this.submitStatus() !== 'sending';
  }

  async submit(): Promise<void> {
    if (this.submitStatus() === 'sending') {
      return;
    }

    if (this.form.invalid) {
      this.markAllTouched();
      this.submitStatus.set('error');
      this.errorMessage.set(
        'Revisa los campos marcados en rojo antes de enviar.',
      );
      return;
    }

    const raw = this.form.getRawValue();

    // Honeypot: si viene relleno, fingimos éxito y reseteamos.
    if (raw.website && raw.website.trim().length > 0) {
      this.submitStatus.set('success');
      this.form.reset({
        name: '',
        email: '',
        category: 'info',
        subject: '',
        message: '',
        website: '',
      });
      return;
    }

    const payload: ContactMessagePayload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      category: raw.category,
      subject: raw.subject ? raw.subject.trim() : undefined,
      message: raw.message.trim(),
      website: raw.website,
    };

    this.submitStatus.set('sending');
    this.errorMessage.set('');

    try {
      const response = await this.contactMessageService.sendContactMessage(payload);
      if (!this.isAlive) return;
      if (response.success) {
        this.submitStatus.set('success');
        this.form.reset({
          name: '',
          email: '',
          category: 'info',
          subject: '',
          message: '',
          website: '',
        });
      } else {
        this.submitStatus.set('error');
        this.errorMessage.set(
          response.error || response.message || 'No se pudo enviar el mensaje.',
        );
      }
    } catch (err: unknown) {
      if (!this.isAlive) return;
      this.submitStatus.set('error');
      const apiError =
        (err as { error?: { error?: string; message?: string } })?.error;
      this.errorMessage.set(
        apiError?.error ||
          apiError?.message ||
          'Ha ocurrido un error inesperado. Inténtalo de nuevo.',
      );
    }
  }
}
