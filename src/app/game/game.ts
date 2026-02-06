import { Component, AfterViewInit ,ViewChild,ElementRef} from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-game',
  standalone: true,
  imports: [],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class GameComponent implements AfterViewInit{
  
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(private router: Router) {}

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;

    (window as any).canvas = canvas;

    (window as any).goToEndScreen = () => {
      this.router.navigate(['/end']);
    };

    (window as any).startGame();
  }

}



