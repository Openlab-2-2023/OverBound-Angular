import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  AfterViewInit,
  NgZone,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

type NpcChatMessage = {
  from: 'npc' | 'player';
  text: string;
};

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  npcChatOpen = false;
  npcName = 'OverBound Guide';
  npcIntro = 'Ask me anything about OverBound.';
  npcQuestion = '';
  npcThinking = false;
  npcMessages: NpcChatMessage[] = [];

  private openNpcChatHandler = (event: Event) => {
    const detail = (event as CustomEvent).detail || {};

    this.zone.run(() => {
      this.openNpcChatFromDetail(detail);
    });
  };

  private closeNpcChatHandler = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && this.npcChatOpen) {
      this.zone.run(() => this.closeNpcChat());
    }
  };

  constructor(
    private router: Router,
    private auth: AuthService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;

    (window as any).canvas = canvas;
    (window as any).npcChatOpen = false;
    (window as any).openNpcChat = (detail: unknown) => {
      this.zone.run(() => this.openNpcChatFromDetail(detail));
    };
    (window as any).closeNpcChat = () => {
      this.zone.run(() => this.closeNpcChat());
    };
    window.addEventListener('openNpcChat', this.openNpcChatHandler);
    window.addEventListener('keydown', this.closeNpcChatHandler);

    // Called from the plain JS game code when an enemy dies.
    // Awards +10 gold to the currently logged-in player and persists it.
    (window as any).onEnemyKilled = () => {
      const current = this.auth.getCurrent();
      if (!current) {
        return;
      }

      // trigger small gold gain animation in the canvas HUD, if available
      try {
        if (typeof (window as any)._addGoldGainFx === 'function') {
          (window as any)._addGoldGainFx(10);
        }
      } catch {
        // ignore HUD errors, keep gameplay running
      }

      const currentGold =
        Number.isFinite(Number((current as any).gold)) ? Number((current as any).gold) : 0;
      const currentTotalGold =
        Number.isFinite(Number((current as any).totalGoldCollected)) ? Number((current as any).totalGoldCollected) : 0;
      const nextGold = currentGold + 10;
      const nextTotalGold = currentTotalGold + 10;

      this.auth
        .updateProfile({ gold: nextGold, totalGoldCollected: nextTotalGold })
        .then((res) => {
          if (!res.ok) {
            console.warn('Failed to update gold after enemy kill:', res.message);
          }
        })
        .catch((err) => {
          console.error('Error updating gold after enemy kill:', err);
        });
    };

    (window as any).goToEndScreen = () => {
      this.zone.run(() => {
        this.router.navigate(['/end']);
      });
    };

    this.zone.runOutsideAngular(() => {
      this.applySkinAndStartGame();
    });
  }

  ngOnDestroy() {
    window.removeEventListener('openNpcChat', this.openNpcChatHandler);
    window.removeEventListener('keydown', this.closeNpcChatHandler);
    (window as any).npcChatOpen = false;
    delete (window as any).openNpcChat;
    delete (window as any).closeNpcChat;

    if (typeof (window as any).stopGame === 'function') {
      (window as any).stopGame();
    }
  }

  private async applySkinAndStartGame() {
    try {
      if (this.auth.isLoggedIn()) {
        await this.auth.refreshCurrentUserFromDatabase();
      }
    } catch {
      // Use the locally cached profile if the hosted database read is unavailable.
    }

    const selectedSkin = this.getEquippedCharacterSkin();
    (window as any).selectedCharacterSkin = selectedSkin;
    if (typeof (window as any).applyCharacterSkin === 'function') {
      (window as any).applyCharacterSkin(selectedSkin);
    }

    (window as any).startGame();
  }

  private getEquippedCharacterSkin(): string {
    const current = this.auth.getCurrent();
    const inventory = Array.isArray(current?.inventory) ? current!.inventory! : [];
    const equippedSkin = inventory.find((item: any) => {
      const id = String(item?.id || '').trim().toLowerCase();
      return item?.equipped && id.startsWith('skin_');
    });

    const skinId = String(equippedSkin?.id || '').trim().toLowerCase();
    if (skinId === 'skin_purple') return 'purple';
    if (skinId === 'skin_green') return 'green';
    return 'default';
  }

  openNpcChat() {
    this.npcChatOpen = true;
    (window as any).npcChatOpen = true;

    if (this.npcMessages.length === 0) {
      this.npcMessages = [
        {
          from: 'npc',
          text: this.npcIntro,
        },
      ];
    }

    this.cdr.detectChanges();

    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.npc-chat__input');
      input?.focus();
    });
  }

  private openNpcChatFromDetail(detail: unknown) {
    const npc = (detail || {}) as { name?: string; intro?: string };

    this.npcName = npc.name || 'OverBound Guide';
    this.npcIntro = npc.intro || 'Ask me anything about OverBound.';
    this.openNpcChat();
  }

  closeNpcChat() {
    this.npcChatOpen = false;
    this.npcQuestion = '';
    (window as any).npcChatOpen = false;
    this.cdr.detectChanges();
  }

  async sendNpcQuestion() {
    const question = this.npcQuestion.trim();
    if (!question || this.npcThinking) {
      return;
    }

    this.npcMessages = [...this.npcMessages, { from: 'player', text: question }];
    this.npcQuestion = '';
    this.npcThinking = true;
    this.cdr.detectChanges();

    try {
      const answer = await this.askNpcGuide(question);
      this.npcMessages = [...this.npcMessages, { from: 'npc', text: answer }];
    } catch {
      this.npcMessages = [
        ...this.npcMessages,
        {
          from: 'npc',
          text: 'I cannot reach the guide service right now, but I can still help with basic controls and objectives.',
        },
      ];
    } finally {
      this.npcThinking = false;
      this.cdr.detectChanges();
      setTimeout(() => {
        const log = document.querySelector<HTMLElement>('.npc-chat__messages');
        if (log) {
          log.scrollTop = log.scrollHeight;
        }
      });
    }
  }

  private async askNpcGuide(question: string): Promise<string> {
    try {
      const response = await fetch('/api/npc-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npc: this.npcName,
          question,
          context: this.getNpcGameContext(),
          history: this.npcMessages.slice(-8),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.answer === 'string' && data.answer.trim()) {
          return data.answer.trim();
        }
      }
    } catch {
      // The local frontend can run without a backend during development.
    }

    return this.getLocalNpcAnswer(question);
  }

  private getNpcGameContext() {
    return {
      controls: 'A/D move, W or Space jump, S crouch, I attack, E talk.',
      room1: 'Room 1 starts the player near the beginning and has a guide NPC plus a portal further right.',
      progression: 'Reach portals to move between areas. Defeat enemies to earn gold.',
      health: 'The heart bar shows player health. Avoid enemies and hazards.',
      trading: 'Gold can be used with the trading and store screens outside gameplay.',
    };
  }

  private getLocalNpcAnswer(question: string): string {
    const q = question.toLowerCase();

    if (q.includes('control') || q.includes('move') || q.includes('jump') || q.includes('key')) {
      return 'Use A and D to move, W or Space to jump, S to crouch, I to attack, and E to talk to NPCs.';
    }

    if (q.includes('portal') || q.includes('next') || q.includes('where')) {
      return 'In room 1, keep moving to the right until you find the portal. Touching a portal moves you to the next area.';
    }

    if (q.includes('enemy') || q.includes('attack') || q.includes('fight')) {
      return 'Press I to attack. Try to avoid contact with enemies, because they can knock you back and reduce your health.';
    }

    if (q.includes('health') || q.includes('die') || q.includes('damage')) {
      return 'Your health is shown in the top-left bar. If it reaches zero, you lose the run and go to the end screen.';
    }

    if (q.includes('gold') || q.includes('coin') || q.includes('trade') || q.includes('store')) {
      return 'Defeating enemies gives you gold. You can use gold in the trading and store parts of the app.';
    }

    return 'I am your room 1 guide. Ask me about controls, portals, enemies, health, gold, trading, or what to do next.';
  }
}
