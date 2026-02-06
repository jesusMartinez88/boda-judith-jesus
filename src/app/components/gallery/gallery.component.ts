import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Photo {
  id: number;
  title: string;
  placeholder: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent {
  photos: Photo[] = [
    { id: 1, title: 'Momento especial 1', placeholder: '📷' },
    { id: 2, title: 'Momento especial 2', placeholder: '📷' },
    { id: 3, title: 'Momento especial 3', placeholder: '📷' },
    { id: 4, title: 'Momento especial 4', placeholder: '📷' },
    { id: 5, title: 'Momento especial 5', placeholder: '📷' },
    { id: 6, title: 'Momento especial 6', placeholder: '📷' }
  ];

  selectedPhoto: Photo | null = null;

  openModal(photo: Photo) {
    this.selectedPhoto = photo;
  }

  closeModal() {
    this.selectedPhoto = null;
  }
}
