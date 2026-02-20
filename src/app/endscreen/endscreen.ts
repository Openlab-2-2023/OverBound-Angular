import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-endscreen',
  templateUrl: './endscreen.html', 
  styleUrls: ['./endscreen.css']
})
export class Endscreen {  

  constructor(private router: Router) {}

  replayGame() {
    // naviguje späť na hru
    this.router.navigate(['/game']);
  }

  goToMenu() {
    // naviguje na menu (Start komponent)
    this.router.navigate(['']);
  }
}