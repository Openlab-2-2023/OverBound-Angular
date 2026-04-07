import { Component, signal, ViewChild, ElementRef, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { FIREBASE_SDK_CONFIG } from '../services/firebase.sdk.config';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './start.html',
  styleUrl: './start.css',
})
export class Start implements OnInit, OnDestroy {
  showSettings = signal(false);
  showCredits = signal(false);
  leaderboardFilter: 'gold-desc' = 'gold-desc';
  leaderboardFilterOpen = false;
  leaderboardUsers: Array<{ email: string; displayName: string; gold: number; role: string; photoURL?: string }> = [];
  leaderboardError = '';
  leaderboardLoadedCount = 0;
  leaderboardHint = '';
  storeGold = 0;
  leaderboardDiag = 'diagnostics: init';
  leaderboardProjectId = FIREBASE_SDK_CONFIG.projectId || 'n/a';
  leaderboardBuildStamp = 'LB-2026-03-27-1250';
  private leaderboardBooted = false;
  private leaderboardUnsubscribe: (() => void) | null = null;
  private leaderboardPollId: any = null;
  private onUserUpdatedListener: EventListener | null = null;
  private onScrollRevealListener: EventListener | null = null;
  private scrollHideTimers = new WeakMap<HTMLElement, any>();

  @ViewChild('contentWrapper') contentWrapper!: ElementRef;
  @ViewChild('blackOverlay') blackOverlay!: ElementRef;

  constructor(private router: Router, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    this.refreshStoreGold();
    this.onUserUpdatedListener = () => this.refreshStoreGold();
    window.addEventListener('ob:user-updated', this.onUserUpdatedListener);
    this.bindAutoHideScrollbars();
    await this.bootstrapLeaderboard();
  }

  ngOnDestroy() {
    if (this.leaderboardUnsubscribe) {
      this.leaderboardUnsubscribe();
      this.leaderboardUnsubscribe = null;
    }
    if (this.leaderboardPollId) {
      clearInterval(this.leaderboardPollId);
      this.leaderboardPollId = null;
    }
    if (this.onUserUpdatedListener) {
      window.removeEventListener('ob:user-updated', this.onUserUpdatedListener);
      this.onUserUpdatedListener = null;
    }
    
    if (this.onScrollRevealListener) {
      document.removeEventListener('scroll', this.onScrollRevealListener, true);
      this.onScrollRevealListener = null;
    }
  }

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

  onLeaderboardFilterChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    if (val === 'gold-desc') {
      this.leaderboardFilter = val;
    }
  }

  get leaderboardFilterLabel() {
    return this.leaderboardFilter === 'gold-desc' ? 'Most Gold' : 'Most Gold';
  }

  toggleLeaderboardFilter() {
    this.leaderboardFilterOpen = !this.leaderboardFilterOpen;
  }

  selectLeaderboardFilter(val: 'gold-desc') {
    this.leaderboardFilter = val;
    this.leaderboardFilterOpen = false;
  }

  get filteredLeaderboard() {
    const rows = this.leaderboardUsers.slice();
    if (this.leaderboardFilter === 'gold-desc') {
      rows.sort((a, b) => b.gold - a.gold);
    }
    return rows.slice(0, 20);
  }

  openLeaderboardProfile(player: { email: string; displayName: string; gold: number; role: string; photoURL?: string }, event?: Event) {
    if (event) event.stopPropagation();
    const email = String(player?.email || '').trim().toLowerCase();
    if (!email) return;
    this.router.navigate(['/account'], {
      queryParams: { view: email },
      state: {
        leaderboardUser: {
          email,
          displayName: player.displayName || email.split('@')[0] || 'Player',
          role: player.role || 'Player',
          gold: Number.isFinite(Number(player.gold)) ? Number(player.gold) : 0,
          photoURL: player.photoURL || '',
        },
      },
    });
  }

  private refreshStoreGold() {
    const current = this.auth.getCurrent();
    this.storeGold = Number.isFinite(Number(current?.gold)) ? Number(current?.gold) : 0;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private async refreshLeaderboard() {
    this.leaderboardDiag = 'step:diagnostics';
    this.cdr.detectChanges();
    try {
      this.leaderboardDiag = await this.withTimeout(
        this.auth.getLeaderboardDiagnostics(),
        5000,
        'Firestore diagnostics',
      );
      this.leaderboardDiag = `${this.leaderboardDiag} | step:users`;
      this.leaderboardUsers = await this.withTimeout(
        this.auth.getLeaderboardUsersFromDatabase(),
        7000,
        'Leaderboard load',
      );
      this.leaderboardLoadedCount = this.leaderboardUsers.length;
      this.leaderboardError = '';
      this.leaderboardHint =
        this.leaderboardUsers.length === 0
          ? `No Firestore players found. Project: ${FIREBASE_SDK_CONFIG.projectId}.`
          : '';
      this.cdr.detectChanges();
    } catch (e: any) {
      try {
        this.leaderboardDiag =
          (await this.withTimeout(
            this.auth.getLeaderboardDiagnostics(),
            3500,
            'Firestore diagnostics',
          )) || 'diagnostics: empty response';
      } catch (diagErr: any) {
        this.leaderboardDiag =
          `diagnostics failed: ${diagErr?.message || 'unknown error'}`;
      }
      this.leaderboardUsers = [];
      this.leaderboardLoadedCount = 0;
      this.leaderboardError = e?.message || 'Could not load leaderboard from database.';
      console.error('Leaderboard load error:', e);
      this.cdr.detectChanges();
    }
    if (!this.leaderboardDiag || !this.leaderboardDiag.trim()) {
      this.leaderboardDiag = 'diagnostics: empty response';
    }
    this.cdr.detectChanges();
  }

  private async bootstrapLeaderboard() {
    if (this.leaderboardBooted) return;
    this.leaderboardBooted = true;
    this.leaderboardDiag = 'step:bootstrap';
    this.auth.waitForFirebaseAuthReady(2500).catch(() => {});
    await this.refreshLeaderboard();
    await this.startRealtimeLeaderboard();
    this.startLeaderboardPolling();
  }

  private async startRealtimeLeaderboard() {
    try {
      this.leaderboardUnsubscribe = await this.auth.subscribeLeaderboardUsers(
        (users) => {
          // Protect against transient empty snapshots overriding known-good data.
          if (users.length === 0 && this.leaderboardUsers.length > 0) {
            this.leaderboardDiag = `${this.leaderboardDiag} | realtime:empty-snapshot-ignored`;
            this.cdr.detectChanges();
            return;
          }
          this.leaderboardUsers = users;
          this.leaderboardLoadedCount = users.length;
          this.leaderboardError = '';
          this.leaderboardHint =
            users.length === 0
              ? `No Firestore players found. Project: ${FIREBASE_SDK_CONFIG.projectId}.`
              : '';
          this.leaderboardDiag = `users:${users.length} | realtime`;
          this.cdr.detectChanges();
        },
        () => {
          // Keep UI stable; polling fallback continues to refresh in background.
        },
      );
    } catch {
      // Ignore realtime init errors; polling fallback still works.
    }
  }

  private startLeaderboardPolling() {
    if (this.leaderboardPollId) clearInterval(this.leaderboardPollId);
    this.leaderboardPollId = setInterval(() => {
      this.refreshLeaderboard().catch((err) => {
        console.error('Leaderboard poll refresh failed', err);
      });
    }, 7000);
  }

  private bindAutoHideScrollbars() {
    const targets = '.auto-scroll';
    this.onScrollRevealListener = (evt: Event) => {
      const rawTarget = evt.target;
      if (!(rawTarget instanceof HTMLElement)) return;
      const hostNode = rawTarget.matches(targets) ? rawTarget : rawTarget.closest(targets);
      if (!(hostNode instanceof HTMLElement)) return;
      const host = hostNode;

      host.classList.add('is-scrolling');
      const prevTimer = this.scrollHideTimers.get(host);
      if (prevTimer) clearTimeout(prevTimer);
      const nextTimer = setTimeout(() => {
        host.classList.remove('is-scrolling');
        this.scrollHideTimers.delete(host);
      }, 700);
      this.scrollHideTimers.set(host, nextTimer);
    };
    document.addEventListener('scroll', this.onScrollRevealListener, true);
  }
}
