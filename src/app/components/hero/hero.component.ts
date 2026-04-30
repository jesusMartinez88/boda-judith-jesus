import { Component, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CountdownComponent } from '../countdown/countdown.component';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CountdownComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('heroContent') heroContent!: ElementRef;
  @ViewChild('heroTitle') heroTitle!: ElementRef;
  @ViewChild('heroSubtitle') heroSubtitle!: ElementRef;
  @ViewChild('heroLocation') heroLocation!: ElementRef;
  @ViewChild('heroCta') heroCta!: ElementRef;
  @ViewChild('countdownWrapper') countdownWrapper!: ElementRef;
  @ViewChild('heroBackground') heroBackground!: ElementRef;
  @ViewChild('heroOverlay') heroOverlay!: ElementRef;
  @ViewChild('particlesCanvas') particlesCanvas!: ElementRef<HTMLCanvasElement>;

  private particles: Array<{ x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }> = [];
  private animationFrameId?: number;

  ngAfterViewInit() {
    this.initAnimations();
    this.initScrollEffects();
    this.initParticles();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }

  private initAnimations() {
    if (!this.heroTitle || !this.heroSubtitle || !this.heroLocation || !this.heroCta || !this.countdownWrapper) {
      console.warn('HeroComponent: Some elements not found for animations');
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } });

    // Configurar estado inicial de todos los elementos
    gsap.set([
      this.heroTitle.nativeElement,
      this.heroSubtitle.nativeElement,
      this.heroLocation.nativeElement,
      this.countdownWrapper.nativeElement,
      this.heroCta.nativeElement
    ], {
      opacity: 0,
      y: 50
    });

    // Animación de entrada secuencial
    tl.to(this.heroTitle.nativeElement, {
      opacity: 1,
      y: 0,
      delay: 0.5
    })
      .to(this.heroSubtitle.nativeElement, {
        opacity: 1,
        y: 0
      }, '-=0.8')
      .to(this.heroLocation.nativeElement, {
        opacity: 1,
        y: 0
      }, '-=0.8')
      .to(this.countdownWrapper.nativeElement, {
        opacity: 1,
        y: 0
      }, '-=0.8')
      .to(this.heroCta.nativeElement, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'back.out(1.7)'
      }, '-=0.6');
  }

  private initScrollEffects() {
    if (!this.heroBackground || !this.heroContent || !this.heroOverlay) {
      return;
    }

    // Parallax 3D en el fondo con zoom
    gsap.to(this.heroBackground.nativeElement, {
      scale: 1.3,
      y: '30%',
      ease: 'none',
      scrollTrigger: {
        trigger: this.heroBackground.nativeElement,
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });

    // Efecto de zoom out en el contenido
    gsap.to(this.heroContent.nativeElement, {
      scale: 0.8,
      y: -100,
      ease: 'power2.in',
      scrollTrigger: {
        trigger: this.heroContent.nativeElement,
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });

    // Morphing de colores en el overlay
    gsap.to(this.heroOverlay.nativeElement, {
      background: 'linear-gradient(135deg, rgba(190, 24, 93, 0.7) 0%, rgba(219, 39, 119, 0.8) 100%)',
      ease: 'none',
      scrollTrigger: {
        trigger: this.heroOverlay.nativeElement,
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });

    // NO hay animación de desaparición para el título - debe permanecer visible
  }

  private initParticles() {
    const canvas = this.particlesCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Crear partículas
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      this.particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.fill();

        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;
      });

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // Redimensionar canvas
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }
}
