import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GameComponent } from './game/game';
import { Start } from './start/start';
import { Endscreen } from './endscreen/endscreen';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GameComponent, Start,Endscreen],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('overbound-angular');
}
