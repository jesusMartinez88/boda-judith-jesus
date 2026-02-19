import { Component, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { gsap } from 'gsap';
import { CountdownComponent } from '../countdown/countdown.component';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CountdownComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css'
})
export class HeroComponent implements AfterViewInit {
  @ViewChild('heroContent') heroContent!: ElementRef;
  @ViewChild('heroTitle') heroTitle!: ElementRef;
  @ViewChild('heroSubtitle') heroSubtitle!: ElementRef;
  @ViewChild('heroLocation') heroLocation!: ElementRef;
  @ViewChild('heroCta') heroCta!: ElementRef;
  @ViewChild('countdownWrapper') countdownWrapper!: ElementRef;

  private ctx?: gsap.Context;

  ngAfterViewInit() {
    this.initAnimations();
  }

  ngOnDestroy() {
    if (this.ctx) {
      this.ctx.revert();
    }
  }

  private initAnimations() {
    // Ensure all elements are available before starting GSAP
    if (!this.heroTitle || !this.heroSubtitle || !this.heroLocation || !this.heroCta || !this.countdownWrapper) {
      console.warn('HeroComponent: Some elements not found for animations');
      return;
    }

    this.ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } });

      // Initial state
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


      // Animation sequence
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
    }, this.heroContent.nativeElement);
  }
}
