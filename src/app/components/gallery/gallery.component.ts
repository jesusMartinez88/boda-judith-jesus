import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
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
  styleUrl: './gallery.component.css'
})
export class GalleryComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sliderTrack') sliderTrack!: ElementRef;

  photos: Photo[] = [
    {
      id: 1,
      title: 'El comienzo',
      placeholder: 'assets/fotos/foto15.jpg',
      description: 'Todo empezó con una mirada y una copa de vino...',
      date: 'Junio 2018'
    },
    {
      id: 2,
      title: 'Viajes inolvidables',
      placeholder: 'assets/fotos/foto12.jpg',
      description: 'Nuestro primer viaje juntos fue el inicio de mil aventuras más.',
      date: 'Agosto 2019'
    },
    {
      id: 3,
      title: 'Cómplices',
      placeholder: 'assets/fotos/foto2.jpeg',
      description: 'Entre risas y momentos compartidos, supimos que era para siempre.',
      date: 'Enero 2022'
    },
    {
      id: 4,
      title: 'La gran pregunta',
      placeholder: 'assets/fotos/foto17.jpeg',
      description: 'Un día cualquiera que se convirtió en el más importante de nuestras vidas.',
      date: 'Agosto 2025'
    },
    {
      id: 5,
      title: 'Hacia el altar',
      placeholder: 'assets/fotos/foto1.jpeg',
      description: 'Contando los días para decir "Sí, quiero" rodeados de nuestra gente.',
      date: 'Octubre 2025'
    }
  ];

  sliderImages = [
    'assets/fotos/foto3.jpeg',
    'assets/fotos/foto4.jpeg',
    'assets/fotos/foto5.jpeg',
    'assets/fotos/foto6.jpeg',
    'assets/fotos/foto7.jpeg',
    'assets/fotos/foto8.jpeg',
    'assets/fotos/foto9.jpeg',
    'assets/fotos/foto10.jpeg',
    'assets/fotos/foto11.jpeg',
    'assets/fotos/foto13.jpg',
    'assets/fotos/foto14.jpg',
    'assets/fotos/foto16.jpg',
  ];

  selectedPhoto: Photo | null = null;
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
    if (!this.sliderTrack) return;

    this.ctx = gsap.context(() => {
      const track = this.sliderTrack.nativeElement;
      const items = track.querySelectorAll('.slider-item');

      // Calculate total width of one set of items
      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: -totalWidth,
        duration: 30,
        ease: 'none',
        repeat: -1,
        onReverseComplete: () => {
          gsap.set(track, { x: 0 });
        }
      });

      // Pause/Resume on hover
      track.addEventListener('mouseenter', () => gsap.globalTimeline.pause());
      track.addEventListener('mouseleave', () => gsap.globalTimeline.resume());
    });
  }

  openModal(photo: Photo) {
    this.selectedPhoto = photo;
  }

  closeModal() {
    this.selectedPhoto = null;
  }
}
