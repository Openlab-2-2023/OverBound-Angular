import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameComponent } from './game/game';
import { Start } from './start/start';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GameComponent, Start],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('overbound-angular');
}
