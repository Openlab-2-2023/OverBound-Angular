import { Component, AfterViewInit ,ViewChild,ElementRef} from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-game',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent implements AfterViewInit{
  
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;

    // expose it to your legacy JS
    (window as any).canvas = canvas;

    (window as any).startGame();
  }

}



