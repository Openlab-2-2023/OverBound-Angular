import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent implements AfterViewInit {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(private router: Router, private auth: AuthService) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;

    (window as any).canvas = canvas;

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
      const nextGold = currentGold + 10;

      this.auth
        .updateProfile({ gold: nextGold })
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
      this.router.navigate(['/end']);
    };

    (window as any).startGame();
  }

}

