import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

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

  constructor(private router: Router, private auth: AuthService) {}

  startGame(event: Event) {
  event.preventDefault();

  this.showSettings.set(false);
  this.showCredits.set(false);

  this.playFadeThenNavigate(['/game']);
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

  isLoggedIn() { return this.auth.isLoggedIn(); }

  private playFadeThenNavigate(commands: any[], extras?: { queryParams?: any }) {
    this.showSettings.set(false);
    this.showCredits.set(false);
    this.contentWrapper.nativeElement.classList.add('fade-ui');

    const fadeDelay = 3750;
    const fadeDuration = 1500;

    setTimeout(() => {
      this.blackOverlay.nativeElement.classList.add('active');
      setTimeout(() => {
        if (extras) this.router.navigate(commands, extras);
        else this.router.navigate(commands);
      }, fadeDuration);
    }, fadeDelay);
  }

  goToLogin(mode?: string) {
    const q: any = {};
    if (mode) q.mode = mode;
    this.router.navigate(['/login'], { queryParams: q });
  }

  goToAccount() { this.router.navigate(['/account']); }
}