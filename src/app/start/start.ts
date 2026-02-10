import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './start.html',
  styleUrl: './start.css',
})
export class Start {
  showSettings = signal(false);
  showCredits = signal(false);

  @ViewChild('contentWrapper') contentWrapper!: ElementRef;
  @ViewChild('blackOverlay') blackOverlay!: ElementRef;

  constructor(private router: Router) {}

  startGame(event: Event) {
  event.preventDefault();

  this.showSettings.set(false);
  this.showCredits.set(false);

  // 1️⃣ fade UI (prvky postupne zmiznú)
  this.contentWrapper.nativeElement.classList.add('fade-ui');

  
  const fadeDelay = 3750;   // 3,5 sekundy
  const fadeDuration = 1500; // 1 sekunda

  
  setTimeout(() => {
    this.blackOverlay.nativeElement.classList.add('active');

    
    setTimeout(() => {
      this.router.navigate(['/game']);
    }, fadeDuration);

  }, fadeDelay);
}
  openSettings() { this.showSettings.set(true); }
  closeSettings() { this.showSettings.set(false); }

  openCredits() { this.showCredits.set(true); }
  closeCredits() { this.showCredits.set(false); }

  get modalStyle() {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }

  get creditsModalStyle() {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
}