import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { gsap } from 'gsap';

interface Photo {
  id: number;
  title: string;
  placeholder: string;
  description: string;
  date?: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.css',
})
export class GalleryComponent implements AfterViewInit, OnDestroy {
  readonly galleryUrls = input<string[]>([]);
  readonly sliderTrack = viewChild.required<ElementRef>('sliderTrack');

  photos: Photo[] = [
    {
      id: 1,
      title: 'El comienzo',
      placeholder: 'assets/fotos/judith-jesus/foto12.jpg',
      description: 'Todo empezó por una casualidad',
      date: '2018',
    },
    {
      id: 2,
      title: 'Viajes inolvidables',
      placeholder: 'assets/fotos/judith-jesus/foto20.jpeg',
      description: 'Nuestro primer viaje juntos fue el inicio de mil aventuras más.',
      date: '2018',
    },
    {
      id: 3,
      title: 'Cómplices',
      placeholder: 'assets/fotos/judith-jesus/foto2.jpeg',
      description: 'Entre risas y momentos compartidos, supimos que era para siempre.',
      date: '2022',
    },
    {
      id: 4,
      title: 'Sumando aventuras',
      placeholder: 'assets/fotos/judith-jesus/foto19.jpeg',
      description: 'Una escapada diferente.',
      date: '2023',
    },
    {
      id: 5,
      title: 'La gran pregunta',
      placeholder: 'assets/fotos/judith-jesus/foto17.jpeg',
      description: 'Un día cualquiera que se convirtió en el más importante de nuestras vidas.',
      date: '2025',
    },
    {
      id: 6,
      title: 'Hacia el altar',
      placeholder: 'assets/fotos/judith-jesus/foto1.jpeg',
      description: 'Contando los días para decir "Sí, quiero" rodeados de nuestra gente.',
      date: '2025',
    },
    {
      id: 7,
      title: 'Ya falta poco...',
      placeholder: 'assets/fotos/judith-jesus/foto18.jpeg',
      description: 'Nuestra fecha mas esperada .',
      date: '2026',
    },
  ];

  sliderImages = [
    'assets/fotos/judith-jesus/foto3.jpeg',
    'assets/fotos/judith-jesus/foto4.jpeg',
    'assets/fotos/judith-jesus/foto5.jpeg',
    'assets/fotos/judith-jesus/foto6.jpeg',
    'assets/fotos/judith-jesus/foto7.jpeg',
    'assets/fotos/judith-jesus/foto8.jpeg',
    'assets/fotos/judith-jesus/foto9.jpeg',
    'assets/fotos/judith-jesus/foto10.jpeg',
    'assets/fotos/judith-jesus/foto11.jpeg',
    'assets/fotos/judith-jesus/foto13.jpg',
    'assets/fotos/judith-jesus/foto14.jpg',
    'assets/fotos/judith-jesus/foto15.jpg',
    'assets/fotos/judith-jesus/foto16.jpg',
  ];

  readonly visibleSliderImages = computed(() =>
    this.galleryUrls().length ? this.galleryUrls() : this.sliderImages,
  );

  selectedPhoto = signal<Photo | null>(null);
  private ctx?: gsap.Context;

  ngAfterViewInit() {
    this.initInfiniteSlider();
  }

  ngOnDestroy() {
    if (this.ctx) {
      this.ctx.revert();
    }
  }

  private initInfiniteSlider() {
    if (!this.sliderTrack()) return;

    this.ctx = gsap.context(() => {
      const track = this.sliderTrack().nativeElement;

      // Calculate total width of one set of items
      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: -totalWidth,
        duration: 30,
        ease: 'none',
        repeat: -1,
        onReverseComplete: () => {
          gsap.set(track, { x: 0 });
        },
      });

      // Pause/Resume on hover
      track.addEventListener('mouseenter', () => gsap.globalTimeline.pause());
      track.addEventListener('mouseleave', () => gsap.globalTimeline.resume());
    });
  }

  openModal(photo: Photo) {
    this.selectedPhoto.set(photo);
  }

  closeModal() {
    this.selectedPhoto.set(null);
  }
}
