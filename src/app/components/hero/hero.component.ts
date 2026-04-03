import { Component, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CountdownComponent } from '../countdown/countdown.component';
import confetti from 'canvas-confetti';

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
  @ViewChild('envelope') envelope!: ElementRef;
  @ViewChild('envelopeFlap') envelopeFlap!: ElementRef;
  @ViewChild('envelopePaper') envelopePaper!: ElementRef;
  @ViewChild('envelopeSeal') envelopeSeal!: ElementRef;
  @ViewChild('sealFragment1') sealFragment1!: ElementRef;
  @ViewChild('sealFragment2') sealFragment2!: ElementRef;
  @ViewChild('sealFragment3') sealFragment3!: ElementRef;
  @ViewChild('sealFragment4') sealFragment4!: ElementRef;
  @ViewChild('sealFragment5') sealFragment5!: ElementRef;

  private ctx?: gsap.Context;
  private particles: Array<{ x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }> = [];
  private animationFrameId?: number;
  envelopeOpened = false;
  showEnvelope = true;

  ngAfterViewInit() {
    // Verificar si el sobre ya fue abierto en esta sesión
    const envelopeWasOpened = sessionStorage.getItem('envelopeOpened');
    
    if (envelopeWasOpened === 'true') {
      // Si ya fue abierto, ocultar el sobre y mostrar el contenido directamente
      this.showEnvelope = false;
      this.envelopeOpened = true;
      if (this.envelope) {
        this.envelope.nativeElement.style.display = 'none';
      }
      this.initParticles();
      this.initAnimations();
      this.initScrollEffects();
    } else {
      // Primera vez, mostrar el sobre
      this.initParticles();
      this.initEnvelopeAnimation();
      this.preloadContent();
      
      // Detectar scroll para abrir el sobre
      window.addEventListener('wheel', this.handleScroll.bind(this), { once: true });
    }
  }

  ngOnDestroy() {
    if (this.ctx) {
      this.ctx.revert();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    window.removeEventListener('wheel', this.handleScroll.bind(this));
  }

  openEnvelope() {
    if (this.envelopeOpened) return;
    this.envelopeOpened = true;
    
    // Guardar en sessionStorage que el sobre fue abierto
    sessionStorage.setItem('envelopeOpened', 'true');

    const tl = gsap.timeline();

    // Efecto de ruptura del sello
    this.breakSeal();

    // Hacer visible la carta antes de que empiece a salir
    gsap.set(this.envelopePaper.nativeElement, {
      opacity: 1,
      visibility: 'visible'
    });

    // Abrir la solapa del sobre (con delay para que se vea la ruptura del sello)
    tl.to(this.envelopeFlap.nativeElement, {
      rotationX: 180,
      duration: 1.5,
      ease: 'power2.inOut',
      transformOrigin: 'top center',
      delay: 0.5
    })
    // Sacar el papel (ahora visible y por encima de la solapa)
    .to(this.envelopePaper.nativeElement, {
      y: -150,
      scale: 1.1,
      duration: 1.2,
      ease: 'power2.out',
      onStart: () => {
        // Confeti cuando empieza a salir el papel
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#be185d', '#db2777', '#f9a8d4', '#fce7f3']
        });
      }
    }, '-=0.3')
    // Expandir el papel
    .to(this.envelopePaper.nativeElement, {
      scale: 1.3,
      duration: 0.8,
      ease: 'power2.inOut'
    })
    // Desvanecer el sobre
    .to(this.envelope.nativeElement, {
      opacity: 0,
      scale: 0.8,
      duration: 0.8,
      ease: 'power2.in'
    }, '-=0.5')
    // Expandir el papel a pantalla completa
    .to(this.envelopePaper.nativeElement, {
      scale: 10,
      opacity: 0,
      duration: 1,
      ease: 'power2.inOut',
      onStart: () => {
        // Iniciar animaciones del contenido antes de que termine el sobre
        this.initAnimations();
        this.initScrollEffects();
      },
      onComplete: () => {
        if (this.envelope) {
          this.envelope.nativeElement.style.display = 'none';
        }
      }
    });
  }

  private breakSeal() {
    if (!this.envelopeSeal) return;

    const fragments = [
      this.sealFragment1,
      this.sealFragment2,
      this.sealFragment3,
      this.sealFragment4,
      this.sealFragment5
    ];

    // Posicionar fragmentos en el centro (donde está el sello)
    fragments.forEach((fragment, index) => {
      if (fragment) {
        gsap.set(fragment.nativeElement, {
          top: '50%',
          left: '50%',
          x: '-50%',
          y: '-50%',
          opacity: 1,
          scale: 1
        });
      }
    });

    const tl = gsap.timeline();

    // Escalar y desvanecer el sello original
    tl.to(this.envelopeSeal.nativeElement, {
      scale: 1.2,
      duration: 0.2,
      ease: 'power2.out'
    })
    .to(this.envelopeSeal.nativeElement, {
      scale: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in'
    });

    // Dispersar fragmentos en diferentes direcciones
    fragments.forEach((fragment, index) => {
      if (!fragment) return;

      const angle = (index / fragments.length) * Math.PI * 2;
      const distance = 150 + Math.random() * 50;
      const xOffset = Math.cos(angle) * distance;
      const yOffset = Math.sin(angle) * distance;
      const rotation = Math.random() * 360;

      gsap.to(fragment.nativeElement, {
        x: xOffset,
        y: yOffset,
        rotation: rotation,
        opacity: 0,
        scale: 0.3 + Math.random() * 0.5,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.1
      });
    });

    // Confeti adicional para el efecto de ruptura
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
        colors: ['#be185d', '#9f1239', '#831843'],
        startVelocity: 30
      });
    }, 200);
  }

  private handleScroll() {
    this.openEnvelope();
  }

  private preloadContent() {
    // Preparar el contenido pero mantenerlo invisible
    if (!this.heroTitle || !this.heroSubtitle || !this.heroLocation || !this.heroCta || !this.countdownWrapper) {
      return;
    }

    // Establecer estado inicial del contenido (precargado pero invisible)
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

    // Preparar ScrollTriggers pero no activarlos aún
    this.prepareScrollEffects();
  }

  private prepareScrollEffects() {
    // Crear los ScrollTriggers pero deshabilitados
    if (!this.heroBackground || !this.heroContent || !this.heroOverlay) {
      return;
    }

    // Los efectos se activarán después de abrir el sobre
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  private initEnvelopeAnimation() {
    if (!this.envelope) return;

    // Animación inicial del sobre (aparece flotando)
    gsap.from(this.envelope.nativeElement, {
      scale: 0,
      rotation: -10,
      opacity: 0,
      duration: 1.5,
      ease: 'elastic.out(1, 0.5)',
      delay: 0.3
    });

    // Animación de flotación continua
    gsap.to(this.envelope.nativeElement, {
      y: -20,
      rotation: 2,
      duration: 2,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
  }

  private initAnimations() {
    if (!this.heroTitle || !this.heroSubtitle || !this.heroLocation || !this.heroCta || !this.countdownWrapper) {
      console.warn('HeroComponent: Some elements not found for animations');
      return;
    }

    // Hacer visible el contenido
    gsap.set(this.heroContent.nativeElement, {
      opacity: 1,
      pointerEvents: 'auto'
    });

    this.ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } });

      // Los elementos ya están en su estado inicial desde preloadContent
      // Empezar inmediatamente sin delay para solaparse con la animación del sobre
      tl.to(this.heroTitle.nativeElement, {
        opacity: 1,
        y: 0,
        delay: 0
      })
        .to(this.heroSubtitle.nativeElement, {
          opacity: 1,
          y: 0
        }, '-=0.9')
        .to(this.heroLocation.nativeElement, {
          opacity: 1,
          y: 0
        }, '-=0.9')
        .to(this.countdownWrapper.nativeElement, {
          opacity: 1,
          y: 0
        }, '-=0.9')
        .to(this.heroCta.nativeElement, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'back.out(1.7)'
        }, '-=0.7');
    }, this.heroContent.nativeElement);
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

    // Efecto de zoom out y fade en el contenido
    gsap.to(this.heroContent.nativeElement, {
      scale: 0.8,
      opacity: 0,
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

    // Efecto de rotación 3D en el título
    if (this.heroTitle) {
      gsap.to(this.heroTitle.nativeElement, {
        rotationX: -15,
        z: -200,
        ease: 'none',
        scrollTrigger: {
          trigger: this.heroTitle.nativeElement,
          start: 'top center',
          end: 'bottom top',
          scrub: 1
        }
      });
    }

    // Dispersión lateral de elementos
    if (this.heroSubtitle) {
      gsap.to(this.heroSubtitle.nativeElement, {
        x: -100,
        opacity: 0,
        ease: 'power2.in',
        scrollTrigger: {
          trigger: this.heroSubtitle.nativeElement,
          start: 'top center',
          end: 'bottom top',
          scrub: 1
        }
      });
    }

    if (this.heroLocation) {
      gsap.to(this.heroLocation.nativeElement, {
        x: 100,
        opacity: 0,
        ease: 'power2.in',
        scrollTrigger: {
          trigger: this.heroLocation.nativeElement,
          start: 'top center',
          end: 'bottom top',
          scrub: 1
        }
      });
    }
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
