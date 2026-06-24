import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { DatePipe } from '@angular/common';
import { form, FormField, required, minLength, pattern, submit } from '@angular/forms/signals';
import { ContactService, Contact } from '../../../services/contact.service';
import { AiGenerateService } from '../../../services/ai-generate.service';
import {
  InfoPopupComponent,
  InfoPopupType,
} from '../../../shared/components/info-popup/info-popup.component';

interface InfoPopupState {
  title: string;
  message: string;
  type: InfoPopupType;
}

@Component({
  selector: 'app-contacts',
  imports: [FormField, ToastComponent, InfoPopupComponent, DatePipe],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsComponent implements OnInit {
  private contactService = inject(ContactService);
  private aiService = inject(AiGenerateService);

  protected readonly contactModel = signal({
    name: '',
    countryCode: '+34',
    phone: '',
  });

  protected readonly contactForm = form(this.contactModel, (s) => {
    required(s.name, { message: 'Nombre es obligatorio' });
    minLength(s.name, 3);
    required(s.countryCode);
    required(s.phone);
    pattern(s.phone, /^[67]\d{8}$/);
  });

  newCategoryName = signal('');
  activeTab = signal('');
  searchQuery = signal('');
  statusFilter = signal<'all' | 'not_sent' | 'sent' | 'responded'>('all');
  isAddingCategory = signal(false);
  isAddingManual = signal(false);
  isGenerating = signal<number | null>(null);
  isGeneratingGeneric = signal(false);
  isMarkingAll = signal(false);
  showDeleteConfirm = signal(false);
  contactToDelete = signal<Contact | null>(null);
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  showGenericInvitation = signal(false);
  genericInvitationText = signal('');
  copySuccess = signal(false);
  infoPopup = signal<InfoPopupState | null>(null);

  contacts = this.contactService.contacts;
  categories = this.contactService.categories;

  filteredContacts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tab = this.activeTab();
    const status = this.statusFilter();
    return this.contacts().filter((c) => {
      const matchesTab = c.side === tab;
      const matchesSearch = c.name.toLowerCase().includes(query) || c.phone.includes(query);

      let matchesStatus = true;
      if (status !== 'all') {
        const contactStatus = this.getInvitationStatus(c.linkSent, c.invitationStatus);
        matchesStatus = contactStatus === status;
      }

      return matchesTab && matchesSearch && matchesStatus;
    });
  });

  async ngOnInit() {
    const cats = await this.contactService.loadCategories();
    const savedTab = (() => {
      try {
        return localStorage.getItem('contacts.activeTab');
      } catch {
        return null;
      }
    })();

    if (savedTab) {
      this.activeTab.set(savedTab);
    } else if (cats.length > 0) {
      this.activeTab.set(cats[0].slug);
    }

    this.contactService.loadContacts();
  }

  setTab(slug: string) {
    this.activeTab.set(slug);
    try {
      localStorage.setItem('contacts.activeTab', slug);
    } catch {
      /* ignore */
    }
  }

  setStatusFilter(value: string) {
    if (value === 'not_sent' || value === 'sent' || value === 'responded') {
      this.statusFilter.set(value);
      return;
    }

    this.statusFilter.set('all');
  }

  async addCategory() {
    const categoryName = this.newCategoryName().trim();
    if (!categoryName) return;
    try {
      const response = await this.contactService.createCategory(categoryName);
      if (response.success) {
        this.newCategoryName.set('');
        this.isAddingCategory.set(false);
      }
    } catch (err) {
      console.error('Error adding category:', err);
    }
  }

  async importFromDevice() {
    // ... (rest of the method stays same, but uses dynamic activeTab)
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      this.showInfoPopup(
        'Importacion no disponible',
        'Tu navegador no soporta la importación de contactos. Por favor, añádelos manualmente.',
      );
      return;
    }

    try {
      interface ImportedContact {
        name?: string[];
        tel?: string[];
      }
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const selectedContacts = await (
        navigator as unknown as {
          contacts: { select(props: string[], opts: { multiple: boolean }): ImportedContact[] };
        }
      ).contacts.select(props, opts);

      if (selectedContacts.length > 0) {
        const contactsToCreate: Contact[] = selectedContacts
          .map((contact) => {
            const rawTel = contact.tel?.[0] ?? '';
            const result = this.parsePhoneNumber(rawTel);

            return {
              name: contact.name?.[0] ?? 'Invitado',
              phone: result.phone,
              countryCode: result.countryCode,
              side: this.activeTab(),
              linkSent: false,
            };
          })
          .filter((contact) => this.isValidPhone(contact.phone));

        if (contactsToCreate.length === 0) {
          this.showInfoPopup(
            'Sin telefonos validos',
            'No se encontraron contactos con teléfonos válidos (9 dígitos, empezando por 6 o 7).',
          );
          return;
        }

        await this.contactService.createContactsBulk(contactsToCreate);
      }
    } catch (err) {
      console.error('Error importing contacts:', err);
    }
  }

  async addManual() {
    submit(this.contactForm, async () => {
      const { name, phone, countryCode } = this.contactModel();

      try {
        await this.contactService.createContact({
          name: name.trim(),
          phone: phone.trim(),
          countryCode,
          side: this.activeTab(),
          linkSent: false,
        });
        this.contactModel.set({ name: '', phone: '', countryCode: '+34' });
        this.contactForm().reset();
        this.isAddingManual.set(false);
      } catch (err) {
        console.error('Error adding manual contact:', err);
      }
    });
  }

  /**
   * Parsea un número de teléfono en cualquier formato y extrae el código de país y el número limpio
   * Formatos soportados:
   * - 678678678
   * - +34 675 67 67 67
   * - +34678678678
   * - 34678678678
   * - +34-678-678-678
   */
  parsePhoneNumber(rawPhone: string): { countryCode: string; phone: string } {
    // Limpiar: eliminar espacios, guiones, paréntesis
    const clean = rawPhone.replace(/[\s\-()]/g, '');

    let countryCode = '+34'; // Por defecto España
    let phone = clean;

    // Caso 1: Empieza con + (ej: +34678678678 o +34675676767)
    if (clean.startsWith('+')) {
      // Intentar extraer código de país (1-3 dígitos después del +)
      const match = clean.match(/^\+(\d{1,3})(\d+)$/);
      if (match) {
        const possibleCode = match[1];
        const possiblePhone = match[2];

        // Validar que el código de país sea conocido
        const knownCodes = ['1', '34', '44', '33', '49', '39', '351', '52', '54', '55'];
        if (knownCodes.includes(possibleCode)) {
          countryCode = '+' + possibleCode;
          phone = possiblePhone;
        } else {
          // Intentar con 2 dígitos
          const code2 = possibleCode.substring(0, 2);
          if (knownCodes.includes(code2)) {
            countryCode = '+' + code2;
            phone = possibleCode.substring(2) + possiblePhone;
          }
        }
      }
    }
    // Caso 2: Empieza con 34 pero no tiene + (ej: 34678678678)
    else if (clean.startsWith('34') && clean.length > 9) {
      countryCode = '+34';
      phone = clean.substring(2);
    }
    // Caso 3: Solo dígitos sin código de país (ej: 678678678)
    else {
      countryCode = '+34';
      phone = clean;
    }

    return { countryCode, phone };
  }

  isValidPhone(phone: string): boolean {
    // Limpiar espacios y prefijos comunes (+34, 34)
    const clean = phone.replace(/\s/g, '').replace(/^\+34|^34/, '');
    const regex = /^[67]\d{8}$/;
    return regex.test(clean);
  }

  // ... (sendInvitation, deleteContact remain same)

  async sendInvitation(contact: Contact) {
    if (!contact.id) return;

    try {
      this.isGenerating.set(contact.id);
      const message = await this.aiService.generate({
        type: 'invitation_text',
        guestName: contact.name,
        stream: false,
      });

      const cleanMessage = String(message).trim();
      const encodedText = encodeURIComponent(cleanMessage);
      // Construir número completo con código de país (sin el +)
      const fullPhone = `${contact.countryCode.replace('+', '')}${contact.phone}`;
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;

      await this.contactService.patchContact(contact.id, {
        linkSent: true,
        invitationStatus: 'sent',
        sentAt: new Date().toISOString(),
      });

      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (err) {
      console.error('Error sending invitation:', err);
      this.showInfoPopup(
        'No se pudo generar el mensaje',
        'Error al generar el mensaje. Por favor, intenta de nuevo.',
        'error',
      );
    } finally {
      this.isGenerating.set(null);
    }
  }

  openDeleteConfirm(contact: Contact) {
    this.contactToDelete.set(contact);
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm() {
    this.showDeleteConfirm.set(false);
    this.contactToDelete.set(null);
  }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (contact?.id) {
      await this.contactService.deleteContact(contact.id);
      this.closeDeleteConfirm();
    }
  }

  // Toggle linkSent flag manually (mark sent / unmark)
  async toggleLinkSent(contact: Contact) {
    if (!contact?.id) return;
    try {
      const willBeSent = !contact.linkSent;
      await this.contactService.patchContact(contact.id, {
        linkSent: willBeSent,
        sentAt: willBeSent ? new Date().toISOString() : undefined,
      });
      // show toast
      this.showAppToast(
        willBeSent ? 'Invitación marcada como enviada' : 'Invitación desmarcada (no enviada)',
        'success',
      );
    } catch (err) {
      console.error('Error toggling sent state:', err);
      this.showInfoPopup(
        'Estado no actualizado',
        'No se pudo actualizar el estado de envío. Intenta de nuevo.',
        'error',
      );
      this.showAppToast('No se pudo actualizar el estado de envío. Intenta de nuevo.', 'error');
    }
  }

  showAppToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
      this.toastMessage.set('');
    }, 3500);
  }

  async setInvitationStatus(contact: Contact, status: 'not_sent' | 'sent' | 'responded') {
    if (!contact?.id) return;
    try {
      const updateData: {
        invitationStatus: 'not_sent' | 'sent' | 'responded';
        linkSent: boolean;
        sentAt?: string;
        respondedAt?: string;
      } = {
        invitationStatus: status,
        linkSent: status !== 'not_sent',
      };
      if (status === 'sent' && !contact.sentAt) {
        updateData.sentAt = new Date().toISOString();
      }
      if (status === 'responded' && !contact.respondedAt) {
        updateData.respondedAt = new Date().toISOString();
      }
      await this.contactService.patchContact(contact.id, updateData);
      const statusLabel =
        status === 'not_sent' ? 'No enviado' : status === 'sent' ? 'Enviado' : 'Respondido';
      this.showAppToast(`Estado cambiado a: ${statusLabel}`, 'success');
    } catch (err) {
      console.error('Error changing invitation status:', err);
      this.showAppToast('No se pudo cambiar el estado. Intenta de nuevo.', 'error');
    }
  }

  hideToast() {
    this.showToast.set(false);
    this.toastMessage.set('');
  }

  getSentCount(slug: string) {
    return this.contacts().filter((c) => c.side === slug && c.linkSent).length;
  }

  getTotalCount(slug: string) {
    return this.contacts().filter((c) => c.side === slug).length;
  }

  getInvitationStatus(linkSent: boolean, invitationStatus?: string): string {
    if (invitationStatus === 'responded') return 'responded';
    if (invitationStatus === 'sent' || linkSent) return 'sent';
    return 'not_sent';
  }

  async generateGenericInvitation() {
    try {
      this.isGeneratingGeneric.set(true);
      this.showGenericInvitation.set(true);
      this.genericInvitationText.set('');

      const message = await this.aiService.generate({
        type: 'invitation_text',
        guestName: 'todos',
        stream: false,
      });

      this.genericInvitationText.set(String(message).trim());

      // Auto-copiar al portapapeles
      await this.copyToClipboard();
    } catch (err) {
      console.error('Error generating generic invitation:', err);
      this.showInfoPopup(
        'No se pudo generar la invitacion',
        'Error al generar la invitación. Por favor, intenta de nuevo.',
        'error',
      );
      this.showGenericInvitation.set(false);
    } finally {
      this.isGeneratingGeneric.set(false);
    }
  }

  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.genericInvitationText());
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      this.showInfoPopup(
        'Copia manual requerida',
        'No se pudo copiar al portapapeles. Por favor, copia el texto manualmente.',
        'warning',
      );
    }
  }

  // Mark all contacts in the active tab as sent
  async markAllInTab() {
    const tab = this.activeTab();
    const toMark = this.contacts().filter((c) => c.side === tab && !c.linkSent);
    if (toMark.length === 0) {
      this.showAppToast('No hay contactos pendientes de marcar en esta pestaña.', 'success');
      return;
    }

    this.isMarkingAll.set(true);
    try {
      await Promise.all(
        toMark.map((c) =>
          this.contactService.patchContact(c.id!, {
            linkSent: true,
            sentAt: new Date().toISOString(),
          }),
        ),
      );
      this.showAppToast(`${toMark.length} contactos marcados como enviados`, 'success');
    } catch (err) {
      console.error('Error marking all contacts:', err);
      this.showAppToast('No se pudieron marcar todos los contactos. Intenta de nuevo.', 'error');
    } finally {
      this.isMarkingAll.set(false);
    }
  }

  closeGenericInvitation() {
    this.showGenericInvitation.set(false);
    this.genericInvitationText.set('');
    this.copySuccess.set(false);
  }

  showInfoPopup(title: string, message: string, type: InfoPopupType = 'info') {
    this.infoPopup.set({ title, message, type });
  }

  closeInfoPopup() {
    this.infoPopup.set(null);
  }

  openWhatsApp(contact: Contact) {
    const fullPhone = `${contact.countryCode.replace('+', '')}${contact.phone}`;
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${fullPhone}`;
    window.open(whatsappUrl, '_blank');
  }
}
