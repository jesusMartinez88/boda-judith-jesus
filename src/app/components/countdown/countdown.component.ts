import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal } from '@angular/core';
import { gsap } from 'gsap';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [],
  templateUrl: './countdown.component.html',
  styleUrl: './countdown.component.css'
})
export class CountdownComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('countdownContainer') countdownContainer!: ElementRef;
  @ViewChild('countdownHeader') countdownHeader!: ElementRef;
  @ViewChild('countdownGrid') countdownGrid!: ElementRef;

  timeRemaining = signal<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  private intervalId: any;
  private weddingDate = new Date('2026-07-11T18:00:00').getTime();
  private ctx?: gsap.Context;

  ngOnInit() {
    this.updateCountdown();
    this.intervalId = setInterval(() => this.updateCountdown(), 1000);
  }

  ngAfterViewInit() {
    // Small delay to ensure all elements are rendered and ready
    setTimeout(() => {
      this.initAnimations();
    }, 100);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.ctx) {
      this.ctx.revert();
    }
  }

  private initAnimations() {
    if (!this.countdownContainer || !this.countdownHeader || !this.countdownGrid) {
      return;
    }

    this.ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } });

      const items = this.countdownGrid.nativeElement.querySelectorAll('.countdown-item');

      // Set initial states explicitly to avoid "stuck" invisible items
      gsap.set(this.countdownHeader.nativeElement, { opacity: 0, y: 30 });
      if (items.length > 0) {
        gsap.set(items, { opacity: 0, y: 20, scale: 0.9 });
      }

      // Animate to visible
      tl.to(this.countdownHeader.nativeElement, {
        opacity: 1,
        y: 0,
        delay: 0.2
      });

      if (items.length > 0) {
        tl.to(items, {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.1,
          ease: 'back.out(1.7)'
        }, '-=0.5');
      }
    }, this.countdownContainer.nativeElement);
  }

  private updateCountdown() {
    const now = new Date().getTime();
    const distance = this.weddingDate - now;

    if (distance < 0) {
      this.timeRemaining.set({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
      });
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const current = this.timeRemaining();
    // Update if any value actually changed (more robust than just seconds)
    if (current.days !== days || current.hours !== hours || current.minutes !== minutes || current.seconds !== seconds) {
      this.timeRemaining.set({ days, hours, minutes, seconds });

      if (current.seconds !== seconds) {
        this.animateNumberChange();
      }
    }
  }

  private animateNumberChange() {
    if (!this.countdownGrid) return;

    // Pulse effect on seconds change
    const secondEl = this.countdownGrid.nativeElement.querySelector('.countdown-item:last-child .countdown-number');
    if (secondEl) {
      gsap.to(secondEl, {
        scale: 1.1,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: 'power1.inOut'
      });
    }
  }
}
