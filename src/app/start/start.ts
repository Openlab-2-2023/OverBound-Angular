import { Component, signal, ViewChild, ElementRef, OnDestroy, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../services/auth.service';
import { FIREBASE_SDK_CONFIG } from '../services/firebase.sdk.config';
import { STORE_ITEMS, StoreItem } from '../store/store-catalog';
import { TradingService } from '../services/trading.service';

type KeybindAction = 'moveLeft' | 'moveRight' | 'jump' | 'jumpAlt' | 'crouch' | 'dash' | 'attack' | 'talk';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './start.html',
  styleUrl: './start.css',
})
export class Start implements OnInit, OnDestroy {
  private readonly keybindStorageKey = 'overbound_keybinds_v1';
  private readonly defaultKeybinds: Record<KeybindAction, string> = {
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    jump: 'KeyW',
    jumpAlt: 'Space',
    crouch: 'KeyS',
    dash: 'KeyO',
    attack: 'KeyI',
    talk: 'KeyE',
  };

  showSettings = signal(false);
  showCredits = signal(false);
  rebindingAction: KeybindAction | null = null;
  keybinds: Record<KeybindAction, string> = { ...this.defaultKeybinds };
  keybindRows: Array<{ action: KeybindAction; label: string }> = [
    { action: 'moveLeft', label: 'Move Left' },
    { action: 'moveRight', label: 'Move Right' },
    { action: 'jump', label: 'Jump' },
    { action: 'jumpAlt', label: 'Jump Alt' },
    { action: 'crouch', label: 'Crouch' },
    { action: 'dash', label: 'Dash' },
    { action: 'attack', label: 'Attack' },
    { action: 'talk', label: 'Talk' },
  ];
  leaderboardFilter: 'gold-desc' | 'items-desc' = 'gold-desc';
  leaderboardFilterOpen = false;
  storeFilter: 'all' | 'frame' | 'skin' = 'all';
  storeFilterOpen = false;
  leaderboardUsers: Array<{ email: string; displayName: string; gold: number; totalGoldCollected: number; role: string; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }> = [];
  leaderboardError = '';
  leaderboardLoadedCount = 0;
  leaderboardHint = '';
  storeGold = 0;
  currentUser: User | null = null;
  storeItems: StoreItem[] = STORE_ITEMS;
  leaderboardDiag = 'diagnostics: init';
  leaderboardProjectId = FIREBASE_SDK_CONFIG.projectId || 'n/a';
  leaderboardBuildStamp = 'LB-2026-03-27-1250';
  unreadForumReplyCount = 0;
  private leaderboardBooted = false;
  private leaderboardUnsubscribe: (() => void) | null = null;
  private leaderboardPollId: any = null;
  private forumUnreadUnsubscribe: (() => void) | null = null;
  private forumNotificationsService: {
    subscribeUnreadReplyCount: (onCount: (count: number) => void, onError?: (error: any) => void) => Promise<() => void>;
  } | null = null;
  private onUserUpdatedListener: EventListener | null = null;
  private onScrollRevealListener: EventListener | null = null;
  private scrollHideTimers = new WeakMap<HTMLElement, any>();

  @ViewChild('contentWrapper') contentWrapper!: ElementRef;
  @ViewChild('blackOverlay') blackOverlay!: ElementRef;

  constructor(
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private tradingService: TradingService,
  ) {}

  async ngOnInit() {
    this.loadKeybinds();
    await this.auth.refreshCurrentUserFromDatabase();
    this.refreshCurrentUser();
    this.refreshStoreGold();
    this.onUserUpdatedListener = () => {
      this.refreshCurrentUser();
      this.refreshStoreGold();
      void this.refreshForumReplyNotifications();
    };
    window.addEventListener('ob:user-updated', this.onUserUpdatedListener);
    this.bindAutoHideScrollbars();
    await this.bootstrapLeaderboard();
    if (this.auth.isLoggedIn()) {
      this.tradingService.primeAvailableUsers();
    }
    await this.refreshForumReplyNotifications();
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
    if (this.forumUnreadUnsubscribe) {
      this.forumUnreadUnsubscribe();
      this.forumUnreadUnsubscribe = null;
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
  openSettings() {
    this.loadKeybinds();
    this.showSettings.set(true);
  }

  closeSettings() {
    this.rebindingAction = null;
    this.showSettings.set(false);
  }

  openCredits() { this.showCredits.set(true); }
  closeCredits() { this.showCredits.set(false); }

  beginRebind(action: KeybindAction, event?: Event) {
    event?.stopPropagation();
    this.rebindingAction = action;
  }

  resetKeybinds(event?: Event) {
    event?.stopPropagation();
    this.keybinds = { ...this.defaultKeybinds };
    this.saveKeybinds();
    this.rebindingAction = null;
  }

  getKeybindLabel(action: KeybindAction): string {
    return this.formatKeyCode(this.keybinds[action]);
  }

  getRebindButtonLabel(action: KeybindAction): string {
    return this.rebindingAction === action ? 'Press key' : this.getKeybindLabel(action);
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent) {
    if (!this.showSettings() || !this.rebindingAction) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.code === 'Escape') {
      this.rebindingAction = null;
      return;
    }

    const blockedCodes = new Set(['Tab', 'CapsLock', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
    if (blockedCodes.has(event.code)) return;

    const previousCode = this.keybinds[this.rebindingAction];
    const duplicateAction = this.keybindRows.find((row) => row.action !== this.rebindingAction && this.keybinds[row.action] === event.code)?.action;
    const nextKeybinds = {
      ...this.keybinds,
      [this.rebindingAction]: event.code,
    };

    if (duplicateAction) {
      nextKeybinds[duplicateAction] = previousCode;
    }

    this.keybinds = nextKeybinds;
    this.saveKeybinds();
    this.rebindingAction = null;
  }

  private loadKeybinds() {
    try {
      const savedKeybinds = JSON.parse(localStorage.getItem(this.keybindStorageKey) || '{}') as Partial<Record<KeybindAction, string>>;
      this.keybinds = {
        ...this.defaultKeybinds,
        ...savedKeybinds,
      };
    } catch {
      this.keybinds = { ...this.defaultKeybinds };
    }
  }

  private saveKeybinds() {
    localStorage.setItem(this.keybindStorageKey, JSON.stringify(this.keybinds));

    const gameWindow = window as Window & {
      setOverboundKeybinds?: (keybinds: Record<KeybindAction, string>) => void;
    };

    if (typeof gameWindow.setOverboundKeybinds === 'function') {
      gameWindow.setOverboundKeybinds(this.keybinds);
    } else {
      window.dispatchEvent(new CustomEvent('overbound:keybinds-updated'));
    }
  }

  private formatKeyCode(code: string): string {
    if (code === 'Space') return 'Space';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    if (code.startsWith('Arrow')) return code.replace('Arrow', 'Arrow ');
    if (code.startsWith('Numpad')) return code.replace('Numpad', 'Numpad ');
    return code;
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

  goToTrading() {
    if (!this.isLoggedIn()) {
      this.goToLogin();
      return;
    }
    this.tradingService.primeAvailableUsers();
    this.router.navigate(['/trading']);
  }

  goToForum() {
    this.router.navigate(['/forum']);
  }

  get currentUserPhoto(): string {
    return String(this.currentUser?.photoURL || '').trim();
  }

  get currentUserInitial(): string {
    const source = String(this.currentUser?.displayName || this.currentUser?.username || this.currentUser?.email || '?').trim();
    return (source.charAt(0) || '?').toUpperCase();
  }

  get currentProfileFrameClass(): string | null {
    const equippedFrame = this.getEquippedProfileFrameId();
    return equippedFrame ? `profile-frame-${equippedFrame}` : null;
  }

  get currentProfileFrameId(): string {
    return this.getEquippedProfileFrameId();
  }

  onLeaderboardFilterChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    if (val === 'gold-desc' || val === 'items-desc') {
      this.leaderboardFilter = val;
    }
  }

  get leaderboardFilterLabel() {
    return this.leaderboardFilter === 'items-desc' ? 'Most Items' : 'Most Gold';
  }

  get storeFilterLabel() {
    if (this.storeFilter === 'frame') return 'Frames';
    if (this.storeFilter === 'skin') return 'Skins';
    return 'All Items';
  }

  toggleLeaderboardFilter() {
    this.leaderboardFilterOpen = !this.leaderboardFilterOpen;
  }

  selectLeaderboardFilter(val: 'gold-desc' | 'items-desc') {
    this.leaderboardFilter = val;
    this.leaderboardFilterOpen = false;
  }

  toggleStoreFilter() {
    this.storeFilterOpen = !this.storeFilterOpen;
  }

  selectStoreFilter(val: 'all' | 'frame' | 'skin') {
    this.storeFilter = val;
    this.storeFilterOpen = false;
  }

  get filteredStoreItems() {
    if (this.storeFilter === 'all') return this.storeItems;
    return this.storeItems.filter((item) => item.type === this.storeFilter);
  }

  get filteredLeaderboard() {
    const rows = this.leaderboardUsers.slice();
    if (this.leaderboardFilter === 'items-desc') {
      rows.sort((a, b) => {
        const itemCountDiff = this.getLeaderboardItemCount(b) - this.getLeaderboardItemCount(a);
        if (itemCountDiff !== 0) return itemCountDiff;
        return b.totalGoldCollected - a.totalGoldCollected;
      });
    } else {
      rows.sort((a, b) => b.totalGoldCollected - a.totalGoldCollected);
    }
    return rows.slice(0, 20);
  }

  getLeaderboardMetric(player: {
    totalGoldCollected: number;
    inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }>;
  }): number {
    return this.leaderboardFilter === 'items-desc'
      ? this.getLeaderboardItemCount(player)
      : player.totalGoldCollected;
  }

  getLeaderboardMetricSuffix(): string {
    return this.leaderboardFilter === 'items-desc' ? 'items' : '◈';
  }

  private getLeaderboardItemCount(player: {
    inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }>;
  }): number {
    return Array.isArray(player.inventory) ? player.inventory.length : 0;
  }

  openLeaderboardProfile(player: { email: string; displayName: string; gold: number; totalGoldCollected: number; role: string; photoURL?: string; inventory?: Array<{ id: string; name: string; icon: string; equipped?: boolean; cost?: number }> }, event?: Event) {
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
          totalGoldCollected: Number.isFinite(Number(player.totalGoldCollected)) ? Number(player.totalGoldCollected) : 0,
          photoURL: player.photoURL || '',
          inventory: Array.isArray(player.inventory) ? player.inventory.slice() : [],
        },
      },
    });
  }

  private refreshStoreGold() {
    const current = this.auth.getCurrent();
    this.storeGold = Number.isFinite(Number(current?.gold)) ? Number(current?.gold) : 0;
  }

  private refreshCurrentUser() {
    this.currentUser = this.auth.getCurrent();
  }

  private async refreshForumReplyNotifications() {
    if (this.forumUnreadUnsubscribe) {
      this.forumUnreadUnsubscribe();
      this.forumUnreadUnsubscribe = null;
    }

    if (!this.auth.isLoggedIn()) {
      this.unreadForumReplyCount = 0;
      this.cdr.detectChanges();
      return;
    }

    try {
      if (!this.forumNotificationsService) {
        const forumModule = await import('../services/forum.service');
        this.forumNotificationsService = new forumModule.ForumService(this.auth);
      }

      this.forumUnreadUnsubscribe = await this.forumNotificationsService.subscribeUnreadReplyCount(
        (count) => {
          this.unreadForumReplyCount = count;
          this.cdr.detectChanges();
        },
        () => {
          this.unreadForumReplyCount = 0;
          this.cdr.detectChanges();
        },
      );
    } catch {
      this.unreadForumReplyCount = 0;
      this.cdr.detectChanges();
    }
  }

  private getEquippedProfileFrameId(): string {
    const inventory = Array.isArray(this.currentUser?.inventory) ? this.currentUser!.inventory! : [];
    const equippedFrame = inventory.find((item) => item?.equipped && String(item.id || '').toLowerCase().startsWith('frame_'));
    return String(equippedFrame?.id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
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
