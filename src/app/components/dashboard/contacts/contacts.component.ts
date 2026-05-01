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
            const rawPhone = c.tel[0].replace(/\s/g, '');
            let countryCode = '+34';
            let phone = rawPhone;
            
            // Detectar y extraer código de país si existe
            if (rawPhone.startsWith('+')) {
              const match = rawPhone.match(/^(\+\d{1,3})(\d+)$/);
              if (match) {
                countryCode = match[1];
                phone = match[2];
              }
            } else if (rawPhone.startsWith('34')) {
              countryCode = '+34';
              phone = rawPhone.substring(2);
            }
            
            return {
              name: c.name[0],
              phone,
              countryCode,
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
}
