import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Cuestionario inicial de la landing que el cliente rellena justo después
 * de registrarse.
 *
 * Es un componente presentacional controlado por el padre
 * (`RegisterComponent`): el padre le pasa los valores iniciales y un
 * `output` con el payload ya saneado cuando el usuario pulsa "Continuar".
 *
 * Decisiones de diseño:
 *   - Standalone + OnPush + signals (cumple guidelines Angular 21).
 *   - Cero dependencias con `HttpClient`: el servicio de cuestionario
 *     lo inyecta el padre, que sabe cuándo llamar a `save()`.
 *   - El color predominante se ofrece con swatches rápidos (rosa, azul,
 *     verde, beige, lavanda, libre) para reducir fricción en móvil.
 *   - El campo `notes` y los servicios extra (autobús, hotel) son
 *     opcionales: el cliente puede no tener autobus/hotel y no pasa nada.
 */
export interface LandingQuestionnaireValue {
  weddingDate: string;
  estimatedGuests: number | null;
  predominantColor: string;
  hasCountdown: boolean;
  hasBusService: boolean;
  hasHotelService: boolean;
  // Extra landing sections
  hasOurStory: boolean;
  hasGallery: boolean;
  hasAddToCalendar: boolean;
  hasVenueMap: boolean;
  hasGiftRegistry: boolean;
  giftBankAccount: string;
  // Contact the couple
  contactCouple: boolean;
  contactGroomPhone: string;
  contactBridePhone: string;
  additionalServices: string;
  notes: string;
}

@Component({
  selector: 'app-landing-questionnaire',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './landing-questionnaire.component.html',
  styleUrl: './landing-questionnaire.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingQuestionnaireComponent {
  /** Estado inicial (por defecto, todo en blanco). */
  initialValue = input<LandingQuestionnaireValue>({
    weddingDate: '',
    estimatedGuests: null,
    predominantColor: '',
    hasCountdown: true,
    hasBusService: false,
    hasHotelService: false,
    hasOurStory: false,
    hasGallery: false,
    hasAddToCalendar: false,
    hasVenueMap: false,
    hasGiftRegistry: false,
    giftBankAccount: '',
    contactCouple: false,
    contactGroomPhone: '',
    contactBridePhone: '',
    additionalServices: '',
    notes: '',
  });

  /** Estado de envío controlado por el padre (para deshabilitar el botón). */
  submitting = input<boolean>(false);

  /** Mensaje de error controlado por el padre (red, validación backend...). */
  errorMessage = input<string | null>(null);

  /**
   * Se dispara cuando el usuario quiere avanzar. El padre es responsable
   * de llamar al backend y decidir qué pantalla mostrar a continuación.
   */
  readonly submitted = output<LandingQuestionnaireValue>();

  /**
   * Estado interno del formulario. Se inicializa desde `initialValue()`
   * cada vez que cambia la entrada (patrón signal-driven).
   */
  protected form = signal<LandingQuestionnaireValue>(this.initialValue());

  /** Swatches rápidos para el color predominante. */
  protected readonly colorPresets = [
    { value: 'rosa', label: 'Rosa', hex: '#ec4899' },
    { value: 'azul', label: 'Azul', hex: '#2563eb' },
    { value: 'verde', label: 'Verde', hex: '#10b981' },
    { value: 'beige', label: 'Beige', hex: '#d4b896' },
    { value: 'lavanda', label: 'Lavanda', hex: '#a78bfa' },
    { value: 'dorado', label: 'Dorado', hex: '#d4af37' },
  ];

  /** ¿Está todo lo obligatorio rellenado? (cuestionario válido). */
  protected readonly isValid = computed(() => {
    const v = this.form();
    if (!v.weddingDate) return false;
    if (v.estimatedGuests === null || v.estimatedGuests === undefined) return false;
    if (Number.isNaN(Number(v.estimatedGuests))) return false;
    if (!v.predominantColor) return false;
    return true;
  });

  /** Helpers para [(ngModel)] con signals. */
  protected patchField<K extends keyof LandingQuestionnaireValue>(
    key: K,
    value: LandingQuestionnaireValue[K],
  ) {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  /** El usuario quiere enviar el cuestionario. */
  protected onSubmit() {
    if (this.submitting()) return;
    if (!this.isValid()) return;
    this.submitted.emit(this.form());
  }

  /** Indica si la opción personalizada 'Otro' está activa. */
  protected readonly isCustomColorSelected = computed(() => {
    const current = this.form().predominantColor;
    if (!current) return false;
    return !this.colorPresets.some((p) => p.value === current);
  });

  /** Valor hexadecimal para el input type="color". */
  protected readonly customColorHex = computed(() => {
    const current = this.form().predominantColor;
    if (current && /^#[0-9a-fA-F]{6}$/i.test(current)) {
      return current;
    }
    return '#ec4899';
  });

  protected isPresetSelected(value: string): boolean {
    return this.form().predominantColor === value;
  }

  protected onColorPresetClick(value: string) {
    this.patchField('predominantColor', value);
  }

  protected onCustomColorChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input?.value) {
      this.patchField('predominantColor', input.value);
    }
  }

  protected onCustomColorClick(): void {
    if (!this.isCustomColorSelected()) {
      this.patchField('predominantColor', this.customColorHex());
    }
  }

  /**
   * ngModelChange del input numérico: convierte string → number para
   * mantener el tipo del signal. Null/"" → null para "sin respuesta".
   * Vive aquí (no inline en el template) porque `Number(...)` no
   * está disponible en el contexto del template compilado.
   */
  protected onEstimatedGuestsChange(value: unknown): void {
    if (value === null || value === '' || value === undefined) {
      this.patchField('estimatedGuests', null);
      return;
    }
    const n = Number(value);
    this.patchField('estimatedGuests', Number.isNaN(n) ? null : n);
  }
}