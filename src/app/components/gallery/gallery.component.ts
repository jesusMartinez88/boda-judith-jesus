import { Component } from '@angular/core';


interface Photo {
  id: number;
  title: string;
  placeholder: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css'
})
export class GalleryComponent {
  photos: Photo[] = [
    { id: 1, title: 'Momento especial 1', placeholder: 'assets/fotos/foto1.jpeg' },
    { id: 2, title: 'Momento especial 2', placeholder: 'assets/fotos/foto2.jpeg' },
    { id: 3, title: 'Momento especial 3', placeholder: 'assets/fotos/foto3.jpeg' },
    { id: 4, title: 'Momento especial 4', placeholder: 'assets/fotos/foto4.jpeg' },
    { id: 5, title: 'Momento especial 5', placeholder: 'assets/fotos/foto5.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto6.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto7.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto8.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto9.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto10.jpeg' },
    { id: 6, title: 'Momento especial 6', placeholder: 'assets/fotos/foto11.jpeg' },
  ];

  selectedPhoto: Photo | null = null;

  openModal(photo: Photo) {
    this.selectedPhoto = photo;
  }

  closeModal() {
    this.selectedPhoto = null;
  }
}
