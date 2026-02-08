import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './contact.component.html',
    styleUrl: './contact.component.css'
})
export class ContactComponent {
    contacts = [
        {
            name: 'Judith',
            role: 'La Novia',
            phone: '+34 650 028 304',
            whatsapp: 'https://wa.me/34650028304'
        },
        {
            name: 'Jesús',
            role: 'El Novio',
            phone: '+34 695 677 269',
            whatsapp: 'https://wa.me/34695677269'
        }
    ];
}
