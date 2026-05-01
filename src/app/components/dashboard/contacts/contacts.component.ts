import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService, Contact } from '../../../services/contact.service';
import { AiGenerateService } from '../../../services/ai-generate.service';

@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './contacts.component.html',
  styleUrl: './contacts.component.css'
})
export class ContactsComponent implements OnInit {
  private contactService = inject(ContactService);
  private aiService = inject(AiGenerateService);
  private fb = inject(FormBuilder);

  contactForm: FormGroup;

  activeTab = signal<string>('novio');
  searchQuery = signal('');
  isAddingManual = signal(false);
  isAddingCategory = signal(false);
  isGenerating = signal<number | null>(null);
  showDeleteConfirm = signal(false);
  contactToDelete = signal<Contact | null>(null);
  showGenericInvitation = signal(false);
  genericInvitationText = signal('');
  isGeneratingGeneric = signal(false);
  copySuccess = signal(false);

  constructor() {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      countryCode: ['+34', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^[67]\d{8}$/)]]
    });
  }

  newCategoryName = '';

  contacts = this.contactService.contacts;
  categories = this.contactService.categories;

  filteredContacts = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const tab = this.activeTab();
    return this.contacts().filter(c => 
      c.side === tab && 
      (c.name.toLowerCase().includes(query) || c.phone.includes(query))
    );
  });

  async ngOnInit() {
    const cats = await this.contactService.loadCategories();
    if (cats.length > 0) {
      this.activeTab.set(cats[0].slug);
    }
    this.contactService.loadContacts();
  }

  setTab(slug: string) {
    this.activeTab.set(slug);
  }

  async addCategory() {
    if (!this.newCategoryName.trim()) return;
    try {
      const response = await this.contactService.createCategory(this.newCategoryName);
      if (response.success) {
        this.newCategoryName = '';
        this.isAddingCategory.set(false);
      }
    } catch (err) {
      console.error('Error adding category:', err);
    }
  }

  async importFromDevice() {
    // ... (rest of the method stays same, but uses dynamic activeTab)
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      alert('Tu navegador no soporta la importación de contactos. Por favor, añádelos manualmente.');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: true };
      const selectedContacts = await (navigator as any).contacts.select(props, opts);

      if (selectedContacts.length > 0) {
        const contactsToCreate: Contact[] = selectedContacts
          .map((c: any) => {
            const result = this.parsePhoneNumber(c.tel[0]);
            
            return {
              name: c.name[0],
              phone: result.phone,
              countryCode: result.countryCode,
              side: this.activeTab(),
              linkSent: false
            };
          })
          .filter((c: any) => this.isValidPhone(c.phone));

        if (contactsToCreate.length === 0) {
          alert('No se encontraron contactos con teléfonos válidos (9 dígitos, empezando por 6 o 7).');
          return;
        }

        await this.contactService.createContactsBulk(contactsToCreate);
      }
    } catch (err) {
      console.error('Error importing contacts:', err);
    }
  }

  async addManual() {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const { name, phone, countryCode } = this.contactForm.value;

    try {
      await this.contactService.createContact({
        name,
        phone,
        countryCode,
        side: this.activeTab(),
        linkSent: false
      });
      this.contactForm.reset({ countryCode: '+34' });
      this.isAddingManual.set(false);
    } catch (err) {
      console.error('Error adding manual contact:', err);
    }
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
    let clean = rawPhone.replace(/[\s\-\(\)]/g, '');
    
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
    let clean = phone.replace(/\s/g, '').replace(/^\+34|^34/, '');
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
        stream: false
      });

      const cleanMessage = String(message).trim();
      const encodedText = encodeURIComponent(cleanMessage);
      // Construir número completo con código de país (sin el +)
      const fullPhone = `${contact.countryCode.replace('+', '')}${contact.phone}`;
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;
      
      await this.contactService.patchContact(contact.id, {
        linkSent: true,
        sentAt: new Date().toISOString()
      });

      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (err) {
      console.error('Error sending invitation:', err);
      alert('Error al generar el mensaje. Por favor, intenta de nuevo.');
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

  getSentCount(slug: string) {
    return this.contacts().filter(c => c.side === slug && c.linkSent).length;
  }

  getTotalCount(slug: string) {
    return this.contacts().filter(c => c.side === slug).length;
  }

  async generateGenericInvitation() {
    try {
      this.isGeneratingGeneric.set(true);
      this.showGenericInvitation.set(true);
      this.genericInvitationText.set('');
      
      const message = await this.aiService.generate({
        type: 'invitation_text',
        guestName: 'todos',
        stream: false
      });

      this.genericInvitationText.set(String(message).trim());
      
      // Auto-copiar al portapapeles
      await this.copyToClipboard();
    } catch (err) {
      console.error('Error generating generic invitation:', err);
      alert('Error al generar la invitación. Por favor, intenta de nuevo.');
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
      alert('No se pudo copiar al portapapeles. Por favor, copia el texto manualmente.');
    }
  }

  closeGenericInvitation() {
    this.showGenericInvitation.set(false);
    this.genericInvitationText.set('');
    this.copySuccess.set(false);
  }
}
